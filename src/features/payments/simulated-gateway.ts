import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { WompiTransaction } from "@/lib/wompi/client";
import { applyWompiTransaction, type ApplyResult } from "./apply-transaction";

/*
 * Built-in demo gateway, used when there are no Wompi keys (a merchant account
 * needs a registered business). It plays Wompi's part: it produces a
 * transaction shaped like the Wompi API returns them and hands it to the same
 * applyWompiTransaction() the webhook uses, so the order state machine, the
 * "pay again" attempts, expiry and emails behave exactly as with Wompi.
 * No card data is ever asked for: the customer only picks the outcome.
 */

export const SIMULATED_OUTCOMES = ["APPROVED", "DECLINED", "ERROR"] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];

export const SIMULATED_TX_PREFIX = "sim_";

export interface SimulatedPayment {
  reference: string;
  method: string;
  amountInCents: bigint;
  order: { id: string; number: string; total: number; expiresAt: Date };
}

/**
 * The attempt the customer may resolve: theirs, still PENDING, never sent to a
 * gateway, on a PENDING order that has not expired. Anything else is null.
 */
export async function findSimulatedPayment(
  db: PrismaClient,
  reference: string,
  userId: string,
  now = new Date(),
): Promise<SimulatedPayment | null> {
  const payment = await db.payment.findUnique({
    where: { reference },
    select: {
      reference: true,
      method: true,
      status: true,
      provider: true,
      providerTxId: true,
      amountInCents: true,
      order: {
        select: {
          id: true,
          number: true,
          userId: true,
          status: true,
          total: true,
          expiresAt: true,
        },
      },
    },
  });
  const order = payment?.order;
  if (
    !payment ||
    !order ||
    payment.provider !== "WOMPI" ||
    payment.status !== "PENDING" ||
    payment.providerTxId !== null ||
    order.userId !== userId ||
    order.status !== "PENDING" ||
    !order.expiresAt ||
    order.expiresAt <= now
  ) {
    return null;
  }
  return {
    reference: payment.reference,
    method: payment.method ?? "CARD",
    amountInCents: payment.amountInCents,
    order: { id: order.id, number: order.number, total: order.total, expiresAt: order.expiresAt },
  };
}

/**
 * Resolves a simulated attempt. The transaction id is claimed first with a
 * conditional update, so a double click (or two tabs) resolves it only once.
 * Returns null when the attempt was not payable or someone else got there first.
 */
export async function completeSimulatedPayment(
  db: PrismaClient,
  payment: SimulatedPayment,
  outcome: SimulatedOutcome,
): Promise<(ApplyResult & { transactionId: string }) | null> {
  const transactionId = `${SIMULATED_TX_PREFIX}${crypto.randomUUID()}`;
  const claimed = await db.payment.updateMany({
    where: { reference: payment.reference, status: "PENDING", providerTxId: null },
    data: { providerTxId: transactionId },
  });
  if (claimed.count !== 1) return null;

  const transaction: WompiTransaction = {
    id: transactionId,
    reference: payment.reference,
    status: outcome,
    amount_in_cents: Number(payment.amountInCents),
    currency: "COP",
    payment_method_type: payment.method,
    status_message: null,
  };
  const result = await applyWompiTransaction(db, transaction, {
    expectedOrderId: payment.order.id,
  });
  return { ...result, transactionId };
}
