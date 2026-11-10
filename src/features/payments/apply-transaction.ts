import type { PrismaClient } from "@prisma/client";
import type { WompiTransaction } from "@/lib/wompi/client";
import { addOrderToSoldCount } from "@/features/orders/sold-count";

/*
 * Applies a Wompi transaction (always as read from the Wompi API) to our
 * Payment and Order. Takes the Prisma client as a parameter so integration
 * tests can run it against a real database. Safe to call any number of times
 * with the same transaction: the webhook, its retries and the redirect page
 * can all race without double-paying an order.
 */

export type ApplyOutcome =
  | "paid" // this call moved the order PENDING -> PAID
  | "updated" // payment attempt updated (declined, voided, error, pending)
  | "unchanged" // already applied before
  | "unknownReference" // no payment attempt with that reference
  | "wrongOrder" // the reference belongs to a different order than expected
  | "mismatch" // amount or currency differ from what we asked for
  | "approvedAfterCancel"; // paid, but the order had already been cancelled: manual review

export interface ApplyResult {
  outcome: ApplyOutcome;
  orderId?: string;
}

const FINAL_STATUSES = new Set(["APPROVED", "DECLINED", "VOIDED", "ERROR"]);

function paymentMethodOf(type: string | null | undefined): "CARD" | "PSE" | null {
  if (type === "CARD") return "CARD";
  if (type === "PSE") return "PSE";
  return null; // Nequi, Bancolombia, etc. keep the method chosen at checkout
}

export async function applyWompiTransaction(
  db: PrismaClient,
  transaction: WompiTransaction,
  options: { expectedOrderId?: string; now?: Date } = {},
): Promise<ApplyResult> {
  const now = options.now ?? new Date();

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { reference: transaction.reference },
      select: {
        id: true,
        orderId: true,
        status: true,
        provider: true,
        amountInCents: true,
        providerTxId: true,
      },
    });
    if (!payment || payment.provider !== "WOMPI") return { outcome: "unknownReference" };
    if (options.expectedOrderId && payment.orderId !== options.expectedOrderId) {
      return { outcome: "wrongOrder" };
    }
    if (
      BigInt(transaction.amount_in_cents) !== payment.amountInCents ||
      transaction.currency !== "COP"
    ) {
      console.error(
        "[payments] amount or currency mismatch",
        transaction.reference,
        transaction.id,
      );
      return { outcome: "mismatch", orderId: payment.orderId };
    }

    // A status Wompi reported as final never changes again (Wompi does not revert
    // them either). The exception is VOIDED set locally by cancel_order() before
    // Wompi ever reported a transaction: Wompi's own answer must still be recorded,
    // otherwise money taken at the last second would be silently ignored.
    const voidedLocally = payment.status === "VOIDED" && payment.providerTxId === null;
    if (
      FINAL_STATUSES.has(payment.status) &&
      payment.status !== transaction.status &&
      !voidedLocally
    ) {
      return { outcome: "unchanged", orderId: payment.orderId };
    }
    const method = paymentMethodOf(transaction.payment_method_type);
    const paymentChanged = await tx.payment.updateMany({
      where: {
        id: payment.id,
        OR: [
          { status: { in: ["PENDING", transaction.status] } },
          { status: "VOIDED", providerTxId: null },
        ],
      },
      data: {
        status: transaction.status,
        providerTxId: transaction.id,
        ...(method ? { method } : {}),
        raw: transaction,
      },
    });

    if (transaction.status !== "APPROVED") {
      return {
        outcome:
          paymentChanged.count > 0 && payment.status !== transaction.status
            ? "updated"
            : "unchanged",
        orderId: payment.orderId,
      };
    }

    // Conditional update: only one caller can move the order out of PENDING.
    const paid = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: now,
        expiresAt: null,
        ...(method ? { paymentMethod: method } : {}),
      },
    });
    if (paid.count === 1) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          from: "PENDING",
          to: "PAID",
          note: `wompi:${transaction.id}`,
        },
      });
      await addOrderToSoldCount(tx, payment.orderId);
      return { outcome: "paid", orderId: payment.orderId };
    }

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: { status: true },
    });
    if (order?.status === "CANCELLED") {
      // Money arrived for a cancelled order (e.g. an old attempt approved late).
      // Nothing is reserved anymore, so the admin must refund it manually; the
      // dashboard lists it until an admin marks it as reviewed.
      console.warn("[payments] approved payment on a cancelled order", transaction.reference);
      return { outcome: "approvedAfterCancel", orderId: payment.orderId };
    }
    return { outcome: "unchanged", orderId: payment.orderId };
  });
}
