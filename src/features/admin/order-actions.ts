"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runInBackground } from "@/lib/background";
import { getDb } from "@/lib/db";
import { sendOrderStatusEmail } from "@/features/orders/emails";
import { ORDER_STATUSES } from "@/features/orders/status";
import { getAdminActor } from "./guard";
import { changeOrderStatus } from "./order-service";

export interface StatusFormState {
  status: "idle" | "error" | "success";
  error?: "forbidden" | "invalid" | "conflict" | "notFound";
  savedAt?: number;
}

const statusSchema = z.object({
  orderId: z.uuid(),
  expectedFrom: z.enum(ORDER_STATUSES),
  to: z.enum(ORDER_STATUSES),
  note: z
    .string()
    .trim()
    .max(240)
    .transform((value) => (value === "" ? null : value)),
});

export async function changeOrderStatusAction(
  _prev: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  const admin = await getAdminActor();
  if (!admin) return { status: "error", error: "forbidden" };

  const parsed = statusSchema.safeParse({
    orderId: formData.get("orderId"),
    expectedFrom: formData.get("expectedFrom"),
    to: formData.get("to"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", error: "invalid" };

  const result = await changeOrderStatus(getDb(), { ...parsed.data, actorId: admin.id });
  revalidatePath("/[locale]/admin", "layout");
  if (!result.ok) return { status: "error", error: result.error };

  const to = parsed.data.to;
  if (to !== "PENDING") {
    runInBackground("order status email", sendOrderStatusEmail(parsed.data.orderId, to));
  }
  return { status: "success", savedAt: Date.now() };
}

/** Closes the "approved after cancel" alert once the admin handled the refund. */
export async function markPaymentReviewedAction(formData: FormData): Promise<void> {
  const admin = await getAdminActor();
  const parsed = z.uuid().safeParse(formData.get("paymentId"));
  if (!admin || !parsed.success) return;

  await getDb().payment.updateMany({
    where: { id: parsed.data, status: "APPROVED", reviewedAt: null },
    data: { reviewedAt: new Date() },
  });
  revalidatePath("/[locale]/admin", "layout");
}
