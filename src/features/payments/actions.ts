"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { runInBackground } from "@/lib/background";
import { getPaymentGateway } from "@/lib/server-env";
import { sendOrderStatusEmail } from "@/features/orders/emails";
import {
  SIMULATED_OUTCOMES,
  completeSimulatedPayment,
  findSimulatedPayment,
} from "./simulated-gateway";

const RETRY_LIMIT = { action: "retry-payment", limit: 5, windowMs: 60 * 60_000 };

/**
 * "Pay again": a new Payment attempt with its own reference (CS-…-A2, A3…),
 * since Wompi never accepts a reference twice. Only after the last attempt
 * failed, while the order is still PENDING and not expired. Limited per user.
 */
export async function retryPaymentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const parsed = z.string().min(1).max(40).safeParse(formData.get("number"));
  if (!user || !parsed.success || !getPaymentGateway()) return;
  const locale = (await getLocale()) as Locale;
  const orderPath = `/account/orders/${encodeURIComponent(parsed.data)}`;

  const db = getDb();
  const order = await db.order.findUnique({
    where: { number: parsed.data },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentMethod: true,
      total: true,
      expiresAt: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      _count: { select: { payments: true } },
    },
  });
  const lastStatus = order?.payments[0]?.status;
  const retryable =
    order &&
    order.userId === user.id &&
    order.status === "PENDING" &&
    order.paymentMethod !== "COD" &&
    order.expiresAt &&
    order.expiresAt > new Date() &&
    lastStatus &&
    ["DECLINED", "VOIDED", "ERROR"].includes(lastStatus);
  if (!retryable) return redirect({ href: orderPath, locale });

  if (!(await consumeRateLimit(`user:${user.id}`, RETRY_LIMIT))) {
    return redirect({ href: `${orderPath}?retry=limited`, locale });
  }

  await db.payment.create({
    data: {
      orderId: order.id,
      provider: "WOMPI",
      reference: `${parsed.data}-A${order._count.payments + 1}`,
      method: order.paymentMethod,
      amountInCents: BigInt(order.total) * 100n,
    },
  });
  return redirect({ href: `${orderPath}?pay=1`, locale });
}

const simulateSchema = z.object({
  ref: z.string().min(1).max(60),
  outcome: z.enum(SIMULATED_OUTCOMES),
});

/**
 * The simulated gateway's "approve / decline / fail" buttons. Only for the
 * owner of a payable attempt, and only while the simulated gateway is active.
 */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const locale = (await getLocale()) as Locale;
  const parsed = simulateSchema.safeParse({
    ref: formData.get("ref"),
    outcome: formData.get("outcome"),
  });
  if (!user || !parsed.success || getPaymentGateway() !== "simulated") {
    return redirect({ href: "/account/orders", locale });
  }

  const db = getDb();
  const payment = await findSimulatedPayment(db, parsed.data.ref, user.id);
  if (!payment) return redirect({ href: "/account/orders", locale });

  const result = await completeSimulatedPayment(db, payment, parsed.data.outcome);
  if (result?.outcome === "paid") {
    runInBackground("order paid email", sendOrderStatusEmail(payment.order.id, "PAID"));
  }
  // ?id= mirrors Wompi's redirect, so the order page shows the same messages.
  const orderPath = `/account/orders/${encodeURIComponent(payment.order.number)}`;
  return redirect({
    href: result ? `${orderPath}?id=${encodeURIComponent(result.transactionId)}` : orderPath,
    locale,
  });
}
