"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { cancelOrder } from "@/features/checkout/place-order";
import { canCustomerCancel } from "./status";

/**
 * Customer cancellation of their own PENDING order. The SQL function re-checks
 * the status under a row lock, so a concurrent payment or expiry is never undone.
 */
export async function cancelMyOrderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const parsed = z.string().min(1).max(40).safeParse(formData.get("number"));
  if (!user || !parsed.success) return;

  const db = getDb();
  const order = await db.order.findUnique({
    where: { number: parsed.data },
    select: { id: true, userId: true, status: true },
  });
  if (!order || order.userId !== user.id || !canCustomerCancel(order.status)) return;

  await cancelOrder(db, order.id, user.id, "customer");
  revalidatePath("/[locale]/account/orders", "layout");
}
