-- Hand-written: order numbering, cancellation/expiry and scheduled jobs.
-- Every function is revoked from anon/authenticated so the Supabase Data API
-- (PostgREST RPC) cannot call it; the app (table owner) and pg_cron can.

-- Human-readable order numbers: CS-2026-000123 (year in Colombian time).
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT 'CS-' || to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY') || '-'
    || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- Cancels an order and releases what it reserved, exactly once. The row lock
-- and the status check make concurrent calls (cron + customer + admin) safe:
-- only the call that moves PENDING/PAID -> CANCELLED returns stock and coupon.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_actor uuid, p_note text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  previous public."OrderStatus";
BEGIN
  SELECT o.status INTO previous FROM public."Order" o WHERE o.id = p_order_id FOR UPDATE;
  IF previous IS NULL OR previous NOT IN ('PENDING', 'PAID') THEN
    RETURN false;
  END IF;

  UPDATE public."Order"
  SET status = 'CANCELLED', "cancelledAt" = now(), "updatedAt" = now()
  WHERE id = p_order_id;

  UPDATE public."ProductVariant" v
  SET stock = v.stock + reserved.quantity
  FROM (
    SELECT i."variantId", sum(i.quantity)::int AS quantity
    FROM public."OrderItem" i
    WHERE i."orderId" = p_order_id
    GROUP BY i."variantId"
  ) reserved
  WHERE v.id = reserved."variantId";

  WITH released AS (
    DELETE FROM public."CouponRedemption" r WHERE r."orderId" = p_order_id RETURNING r."couponId"
  )
  UPDATE public."Coupon" c
  SET "usedCount" = c."usedCount" - 1, "updatedAt" = now()
  FROM released
  WHERE c.id = released."couponId";

  UPDATE public."Payment" p
  SET status = 'VOIDED', "updatedAt" = now()
  WHERE p."orderId" = p_order_id AND p.status = 'PENDING';

  INSERT INTO public."OrderStatusHistory" ("id", "orderId", "from", "to", "changedById", "note")
  VALUES (gen_random_uuid(), p_order_id, previous, 'CANCELLED', p_actor, p_note);

  RETURN true;
END;
$$;

-- Cancels PENDING orders whose expiresAt passed (unpaid Wompi or unconfirmed COD).
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  expired_id uuid;
  cancelled integer := 0;
BEGIN
  FOR expired_id IN
    SELECT o.id FROM public."Order" o
    WHERE o.status = 'PENDING' AND o."expiresAt" IS NOT NULL AND o."expiresAt" < now()
    ORDER BY o."expiresAt"
    LIMIT 500
  LOOP
    IF public.cancel_order(expired_id, NULL, 'expired') THEN
      cancelled := cancelled + 1;
    END IF;
  END LOOP;
  RETURN cancelled;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_rate_limit_hits()
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM public."RateLimitHit" WHERE "createdAt" < now() - interval '1 day';
$$;

-- Daily reset of the shared demo customer (email stored in Setting "demoUserEmail"):
-- cancels its pending orders (returning stock) and drops favorites and extra addresses.
CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  demo_id uuid;
  pending_id uuid;
BEGIN
  SELECT p.id INTO demo_id
  FROM public."Profile" p
  JOIN public."Setting" s ON s.key = 'demoUserEmail' AND p.email = s.value #>> '{}';
  IF demo_id IS NULL THEN
    RETURN;
  END IF;

  FOR pending_id IN SELECT o.id FROM public."Order" o WHERE o."userId" = demo_id AND o.status = 'PENDING' LOOP
    PERFORM public.cancel_order(pending_id, NULL, 'demo reset');
  END LOOP;

  DELETE FROM public."Favorite" WHERE "userId" = demo_id;
  DELETE FROM public."Address" WHERE "userId" = demo_id AND label <> 'Casa';
  UPDATE public."Address" SET "isDefault" = true, "updatedAt" = now()
  WHERE "userId" = demo_id AND label = 'Casa';
END;
$$;

REVOKE ALL ON SEQUENCE public.order_number_seq FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.next_order_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid, uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.expire_pending_orders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.purge_rate_limit_hits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM anon, authenticated, public;

-- Scheduled jobs (cron.schedule with a name replaces an existing job of that name).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule('expire-pending-orders', '*/5 * * * *', 'SELECT public.expire_pending_orders()');
SELECT cron.schedule('purge-rate-limit-hits', '17 3 * * *', 'SELECT public.purge_rate_limit_hits()');
-- 08:00 UTC = 03:00 in Bogotá.
SELECT cron.schedule('reset-demo-data', '0 8 * * *', 'SELECT public.reset_demo_data()');
