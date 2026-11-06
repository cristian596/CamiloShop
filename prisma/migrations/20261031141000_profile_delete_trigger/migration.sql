-- Hand-written. Prisma introspection rejects foreign keys into the auth schema
-- (P4002), which breaks `npm run db:diff`. The same guarantee is kept with a
-- trigger: deleting an auth user deletes its profile, and the delete fails
-- (rolling back the auth deletion) while the profile still has orders.
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_id_auth_users_fkey";

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public."Profile" WHERE "id" = old.id;
  RETURN old;
END;
$$;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

REVOKE EXECUTE ON FUNCTION public.handle_user_deleted() FROM authenticated, anon, public;
