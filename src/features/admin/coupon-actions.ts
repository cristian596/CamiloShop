"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { couponSchema } from "./coupon-schema";
import { getAdminActor } from "./guard";
import { adminFieldErrors, type AdminFormState } from "./product-schema";

const COUPONS_PATH = "/[locale]/admin/coupons";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Create (no couponId) or update a coupon. usedCount is never edited by hand. */
export async function saveCouponAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };

  const couponId = z.uuid().safeParse(formData.get("couponId"));
  const parsed = couponSchema.safeParse({
    code: text(formData, "code"),
    type: text(formData, "type"),
    value: text(formData, "value"),
    isActive: formData.get("isActive") === "on",
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    maxUses: text(formData, "maxUses"),
    minSubtotal: text(formData, "minSubtotal") || "0",
  });
  if (!parsed.success) return { status: "error", fieldErrors: adminFieldErrors(parsed.error) };

  const db = getDb();
  try {
    if (couponId.success) {
      await db.coupon.update({ where: { id: couponId.data }, data: parsed.data });
    } else {
      await db.coupon.create({ data: parsed.data });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { status: "error", fieldErrors: { code: "codeTaken" } };
      if (error.code === "P2025") return { status: "error", error: "notFound" };
    }
    console.error("[admin] save coupon failed", error);
    return { status: "error", error: "generic" };
  }
  revalidatePath(COUPONS_PATH, "page");
  return { status: "success", savedAt: Date.now() };
}

/** Deletes a coupon nobody used; used coupons are deactivated instead. */
export async function deleteCouponAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };
  const id = z.uuid().safeParse(formData.get("couponId"));
  if (!id.success) return { status: "error", error: "invalid" };

  const db = getDb();
  const redemptions = await db.couponRedemption.count({ where: { couponId: id.data } });
  if (redemptions > 0) return { status: "error", error: "hasOrders" };
  await db.coupon.deleteMany({ where: { id: id.data } });
  revalidatePath(COUPONS_PATH, "page");
  return { status: "success", savedAt: Date.now() };
}
