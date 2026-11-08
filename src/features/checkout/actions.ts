"use server";

import { revalidatePath } from "next/cache";
import { LEGAL_VERSION } from "@/config/legal";
import { getCurrentUser } from "@/lib/auth";
import { runInBackground } from "@/lib/background";
import { getDb } from "@/lib/db";
import { getPaymentGateway, getServerEnv } from "@/lib/server-env";
import { sendOrderConfirmation } from "@/features/orders/emails";
import {
  buildQuote,
  placeOrder,
  placeOrderSchema,
  quoteInputSchema,
  type PlaceOrderResult,
  type Quote,
} from "./place-order";

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: "auth" | "invalid" };

/** Live totals for the checkout page; read-only, recomputed from the database. */
export async function quoteCheckoutAction(input: unknown): Promise<QuoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return { ok: true, quote: await buildQuote(getDb(), user.id, parsed.data) };
}

export type PlaceOrderActionResult =
  PlaceOrderResult | { ok: false; error: "auth" | "terms" | "invalid" | "paymentUnavailable" };

export async function placeOrderAction(input: unknown): Promise<PlaceOrderActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };

  // Checked separately so a direct call without consent gets a precise error.
  if ((input as { acceptTerms?: unknown } | null)?.acceptTerms !== true) {
    return { ok: false, error: "terms" };
  }
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.paymentMethod !== "COD" && !getPaymentGateway()) {
    return { ok: false, error: "paymentUnavailable" };
  }

  const env = getServerEnv();
  const result = await placeOrder(getDb(), user.id, parsed.data, {
    expiresInMinutes:
      parsed.data.paymentMethod === "COD" ? env.COD_ORDER_EXPIRY_MINUTES : env.ORDER_EXPIRY_MINUTES,
    termsVersion: LEGAL_VERSION,
  });

  if (result.ok) {
    runInBackground("order confirmation email", sendOrderConfirmation(result.orderId));
    revalidatePath("/[locale]/account", "layout");
  }
  return result;
}
