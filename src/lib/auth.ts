import "server-only";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * The signed-in user from the verified JWT (no database access), or null.
 * Cached per request, so layouts, pages and actions can all call it.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const metadata = (claims.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const name = [metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    name: name ?? null,
  };
});

/** Signed-in user or a redirect to the login page (coming back to `nextPath`). */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;

  const locale = (await getLocale()) as Locale;
  const query = nextPath ? `?next=${encodeURIComponent(`/${locale}${nextPath}`)}` : "";
  return redirect({ href: `/login${query}`, locale });
}

/**
 * Signed-in admin, checked against Profile.role in the database (the JWT role
 * claim can be stale until the token refreshes). Non-admins get a 404, so the
 * admin area does not reveal that it exists.
 */
export async function requireAdmin(nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  const profile = await getDb().profile.findUnique({
    where: { id: user.id },
    select: { role: true, isActive: true },
  });
  if (profile?.role !== "ADMIN" || !profile.isActive) notFound();
  return user;
}
