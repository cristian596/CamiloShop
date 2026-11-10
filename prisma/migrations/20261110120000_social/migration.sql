-- Phase 7a: reviews and questions. No schema changes; hand-written SQL only.

-- Ratings are derived from real reviews only. The seed used to store invented
-- averages; from now on ratingAvg/ratingCount always match the Review table
-- (zero when a product has no reviews yet).
UPDATE public."Product" p
SET "ratingAvg" = coalesce(r.avg, 0),
    "ratingCount" = coalesce(r.count, 0)
FROM (
  SELECT pr.id, avg(rv.rating)::float AS avg, count(rv.id)::int AS count
  FROM public."Product" pr
  LEFT JOIN public."Review" rv ON rv."productId" = pr.id
  GROUP BY pr.id
) r
WHERE p.id = r.id;

-- The daily demo reset now also clears what visitors wrote with the shared
-- demo account (reviews, questions) and recomputes the affected ratings.
CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  demo_id uuid;
  pending_id uuid;
  reviewed uuid[];
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

  WITH removed AS (
    DELETE FROM public."Review" WHERE "userId" = demo_id RETURNING "productId"
  )
  SELECT array_agg(DISTINCT "productId") INTO reviewed FROM removed;

  IF reviewed IS NOT NULL THEN
    UPDATE public."Product" p
    SET "ratingAvg" = coalesce((SELECT avg(r.rating)::float FROM public."Review" r WHERE r."productId" = p.id), 0),
        "ratingCount" = (SELECT count(*)::int FROM public."Review" r WHERE r."productId" = p.id)
    WHERE p.id = ANY (reviewed);
  END IF;

  DELETE FROM public."Question" WHERE "userId" = demo_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM anon, authenticated, public;
