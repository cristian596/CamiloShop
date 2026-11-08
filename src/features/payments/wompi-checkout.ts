import "server-only";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { getPaymentGateway, getWompiConfig, type PaymentGateway } from "@/lib/server-env";
import { WOMPI_CHECKOUT_URL, fetchWompiTransaction } from "@/lib/wompi/client";
import { integritySignature } from "@/lib/wompi/signature";
import { runInBackground } from "@/lib/background";
import type { ShippingAddressSnapshot } from "@/features/checkout/place-order";
import { sendOrderStatusEmail } from "@/features/orders/emails";
import { applyWompiTransaction } from "./apply-transaction";

export interface WompiCheckoutForm {
  action: string;
  fields: [name: string, value: string][];
}

/** What the order page offers for an online-payment order. */
export type PaymentPanel =
  | { kind: "pay"; gateway: PaymentGateway; form: WompiCheckoutForm } // attempt ready: open the gateway
  | { kind: "processing" } // Wompi has a transaction in progress (e.g. PSE)
  | { kind: "retry"; lastStatus: string; message: string | null } // last attempt failed
  | { kind: "expired" };

interface PayableOrder {
  id: string;
  number: string;
  userId: string;
  status: string;
  paymentMethod: string;
  total: number;
  taxAmount: number;
  expiresAt: Date | null;
  shippingAddress: ShippingAddressSnapshot;
}

/**
 * Web Checkout form fields, signed on the server. The expiration time is part
 * of the signature, so Wompi refuses payments after the order expires.
 */
async function buildCheckoutForm(
  order: PayableOrder,
  reference: string,
  locale: Locale,
  gateway: PaymentGateway,
): Promise<WompiCheckoutForm | null> {
  if (gateway === "simulated") {
    // The built-in demo gateway reads amount and owner from the database itself.
    return { action: `/${locale}/checkout/simulated`, fields: [["ref", reference]] };
  }
  const config = getWompiConfig();
  if (!config || !order.expiresAt) return null;

  const amountInCents = order.total * 100;
  const expirationTime = order.expiresAt.toISOString();
  const customer = await getDb().profile.findUnique({
    where: { id: order.userId },
    select: { email: true, fullName: true },
  });
  const address = order.shippingAddress;
  const redirectUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}/account/orders/${encodeURIComponent(order.number)}`;

  const fields: [string, string][] = [
    ["public-key", config.publicKey],
    ["currency", "COP"],
    ["amount-in-cents", String(amountInCents)],
    ["reference", reference],
    [
      "signature:integrity",
      await integritySignature({
        reference,
        amountInCents,
        currency: "COP",
        expirationTime,
        secret: config.integritySecret,
      }),
    ],
    ["expiration-time", expirationTime],
    ["redirect-url", redirectUrl],
    ["tax-in-cents:vat", String(order.taxAmount * 100)],
    ["customer-data:email", customer?.email ?? ""],
    ["customer-data:full-name", customer?.fullName ?? address.recipient],
    ["customer-data:phone-number", address.phone],
    ["customer-data:phone-number-prefix", "+57"],
    ["shipping-address:address-line-1", address.line1],
    ["shipping-address:country", "CO"],
    ["shipping-address:region", address.department],
    ["shipping-address:city", address.city],
    ["shipping-address:phone-number", address.phone],
    ["shipping-address:name", address.recipient],
  ];
  if (address.line2) fields.push(["shipping-address:address-line-2", address.line2]);

  return { action: WOMPI_CHECKOUT_URL, fields: fields.filter(([, value]) => value !== "") };
}

export async function getPaymentPanel(
  order: PayableOrder,
  locale: Locale,
): Promise<PaymentPanel | null> {
  const gateway = getPaymentGateway();
  if (order.status !== "PENDING" || order.paymentMethod === "COD" || !gateway) return null;
  if (!order.expiresAt || order.expiresAt <= new Date()) return { kind: "expired" };

  const latest = await getDb().payment.findFirst({
    where: { orderId: order.id, provider: "WOMPI" },
    orderBy: { createdAt: "desc" },
    select: { reference: true, status: true, providerTxId: true, raw: true },
  });
  if (!latest) return null;

  if (latest.status === "PENDING") {
    if (latest.providerTxId) return { kind: "processing" };
    const form = await buildCheckoutForm(order, latest.reference, locale, gateway);
    return form ? { kind: "pay", gateway, form } : null;
  }
  const raw = latest.raw as { status_message?: string | null } | null;
  return { kind: "retry", lastStatus: latest.status, message: raw?.status_message ?? null };
}

/**
 * Wompi appends ?id=<transaction id> to the redirect URL. That id is only a
 * hint: the status is read from the Wompi API and applied like a webhook, and
 * only if the transaction belongs to this order. Lets local development work
 * without a public webhook URL; in production the webhook usually wins the race.
 */
export async function syncReturnedTransaction(orderId: string, transactionId: string) {
  const config = getWompiConfig();
  if (!config || getPaymentGateway() !== "wompi") return;
  const transaction = await fetchWompiTransaction(config, transactionId);
  if (!transaction) return;
  const result = await applyWompiTransaction(getDb(), transaction, { expectedOrderId: orderId });
  if (result.outcome === "paid") {
    runInBackground("order paid email", sendOrderStatusEmail(orderId, "PAID"));
  }
}
