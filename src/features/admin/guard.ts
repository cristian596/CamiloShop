import "server-only";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * The signed-in, active admin, or null. Every admin Server Action starts with
 * this: actions are public POST endpoints, so the layout's requireAdmin() is
 * not enough (and the JWT role claim may be stale, so the database decides).
 */
export async function getAdminActor(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getDb().profile.findUnique({
    where: { id: user.id },
    select: { role: true, isActive: true },
  });
  return profile?.role === "ADMIN" && profile.isActive ? user : null;
}
