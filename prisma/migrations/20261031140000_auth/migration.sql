-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "privacyVersion" TEXT,
ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Hand-written SQL (Prisma does not model the auth schema, triggers or hooks).
-- ---------------------------------------------------------------------------

-- Profile.id is the Supabase Auth user id. Deleting an auth user removes the
-- profile, unless it still has orders (Order -> Profile is ON DELETE RESTRICT).
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_id_auth_users_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users ("id") ON DELETE CASCADE;

-- Creates the profile when Supabase Auth creates a user (email sign-up, Google
-- or the Admin API). Metadata comes from signUp/createUser options.data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public."Profile" ("id", "email", "fullName", "locale", "privacyAcceptedAt", "privacyVersion", "updatedAt")
  VALUES (
    new.id,
    coalesce(new.email, new.id::text || '@users.invalid'),
    nullif(left(coalesce(meta->>'full_name', meta->>'name', ''), 120), ''),
    CASE WHEN meta->>'locale' IN ('es', 'en') THEN meta->>'locale' ELSE 'es' END,
    CASE WHEN nullif(meta->>'privacy_version', '') IS NOT NULL THEN now() END,
    nullif(left(coalesce(meta->>'privacy_version', ''), 20), ''),
    now()
  )
  ON CONFLICT ("id") DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keeps Profile.email in sync when the user changes their email in Auth.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public."Profile" SET "email" = new.email, "updatedAt" = now() WHERE "id" = new.id;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (new.email IS DISTINCT FROM old.email AND new.email IS NOT NULL)
  EXECUTE FUNCTION public.handle_user_email_change();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_change() FROM authenticated, anon, public;

-- Users created before this migration.
INSERT INTO "Profile" ("id", "email", "updatedAt")
SELECT u.id, coalesce(u.email, u.id::text || '@users.invalid'), now()
FROM auth.users u
ON CONFLICT ("id") DO NOTHING;

-- Custom Access Token Hook: adds app_metadata.user_role ("admin" | "customer")
-- to every JWT. It is a UX hint only (middleware redirects); requireAdmin()
-- always re-reads Profile.role. Enable it in Authentication > Hooks.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims jsonb := event->'claims';
  user_role text;
BEGIN
  SELECT lower(p."role"::text) INTO user_role
  FROM public."Profile" p
  WHERE p."id" = (event->>'user_id')::uuid;

  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  END IF;
  claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(coalesce(user_role, 'customer')));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON TABLE "Profile" TO supabase_auth_admin;

CREATE POLICY "Auth admin reads roles" ON "Profile" FOR SELECT TO supabase_auth_admin USING (true);
