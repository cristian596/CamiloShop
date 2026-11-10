"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/server";
import { getAdminActor } from "./guard";
import type { AdminFormState } from "./product-schema";

const USERS_PATH = "/[locale]/admin/users";
/** Supabase bans are durations; this one outlives the project. */
const BAN_FOREVER = "876000h";

/**
 * Signs a user out everywhere: deleting their auth sessions invalidates every
 * refresh token, so the next token refresh fails. An access token already
 * issued stays valid until it expires (one hour at most), which is why the
 * admin area and every admin action read the role from the database instead.
 */
async function revokeSessions(userId: string) {
  await getDb().$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${userId}::uuid`;
}

const userSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["CUSTOMER", "ADMIN"]),
});

async function loadTarget(userId: string) {
  return getDb().profile.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  });
}

/** The shared demo account's password is public: it must never become an admin. */
function isDemoAccount(email: string) {
  const demo = getServerEnv().DEMO_USER_EMAIL;
  return demo !== undefined && email.toLowerCase() === demo.toLowerCase();
}

export async function changeUserRoleAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminActor();
  if (!admin) return { status: "error", error: "forbidden" };
  const parsed = userSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", error: "invalid" };
  if (parsed.data.userId === admin.id) return { status: "error", error: "self" };

  const target = await loadTarget(parsed.data.userId);
  if (!target) return { status: "error", error: "notFound" };
  if (parsed.data.role === "ADMIN" && isDemoAccount(target.email)) {
    return { status: "error", error: "forbidden" };
  }
  if (target.role === parsed.data.role) return { status: "success", savedAt: Date.now() };

  await getDb().profile.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });
  // The role travels in the JWT (custom access token hook): sign the user out
  // so their next session carries the new one.
  await revokeSessions(target.id);
  revalidatePath(USERS_PATH, "page");
  return { status: "success", savedAt: Date.now() };
}

/**
 * Deactivates (bans in Supabase Auth + signs out) or reactivates a user.
 * Their orders and data stay: deleting accounts is a separate, legal process.
 */
export async function setUserActiveAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminActor();
  if (!admin) return { status: "error", error: "forbidden" };
  const parsed = z
    .object({ userId: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ userId: formData.get("userId"), active: formData.get("active") });
  if (!parsed.success) return { status: "error", error: "invalid" };
  if (parsed.data.userId === admin.id) return { status: "error", error: "self" };

  const target = await loadTarget(parsed.data.userId);
  if (!target) return { status: "error", error: "notFound" };
  const active = parsed.data.active === "true";

  const { error } = await createAdminClient().auth.admin.updateUserById(target.id, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (error) {
    console.error("[admin] could not update the auth ban", error.message);
    return { status: "error", error: "generic" };
  }
  await getDb().profile.update({ where: { id: target.id }, data: { isActive: active } });
  if (!active) await revokeSessions(target.id);
  revalidatePath(USERS_PATH, "page");
  return { status: "success", savedAt: Date.now() };
}
