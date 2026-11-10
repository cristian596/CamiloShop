import type { PrismaClient } from "@prisma/client";
import { cancelOrder } from "@/features/checkout/place-order";
import { addOrderToSoldCount } from "@/features/orders/sold-count";
import type { OrderStatusValue } from "@/features/orders/status";
import { adminTransitions } from "./order-transitions";

export type ChangeStatusResult =
  { ok: true; from: OrderStatusValue } | { ok: false; error: "notFound" | "invalid" | "conflict" };

const TIMESTAMP_FIELD = {
  PAID: "paidAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
} as const;

/**
 * Applies an admin status change. Takes the Prisma client as a parameter so
 * integration tests run it against the real database.
 *
 * The update is conditional on the status the admin saw (`expectedFrom`), so two
 * admins (or the admin and the expiry cron) racing on the same order cannot both
 * win: the loser gets "conflict" and sees the fresh state.
 */
export async function changeOrderStatus(
  db: PrismaClient,
  input: {
    orderId: string;
    expectedFrom: OrderStatusValue;
    to: OrderStatusValue;
    actorId: string;
    note: string | null;
  },
  now = new Date(),
): Promise<ChangeStatusResult> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { status: true, paymentMethod: true },
  });
  if (!order) return { ok: false, error: "notFound" };
  if (order.status !== input.expectedFrom) return { ok: false, error: "conflict" };
  if (!adminTransitions(order.status, order.paymentMethod).includes(input.to)) {
    return { ok: false, error: "invalid" };
  }

  if (input.to === "CANCELLED") {
    const cancelled = await cancelOrder(db, input.orderId, input.actorId, input.note ?? "admin");
    return cancelled ? { ok: true, from: order.status } : { ok: false, error: "conflict" };
  }

  const to = input.to;
  if (to === "PENDING") return { ok: false, error: "invalid" };
  const from = order.status;

  return db.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: input.orderId, status: from },
      data: {
        status: to,
        [TIMESTAMP_FIELD[to]]: now,
        ...(to === "PAID" ? { expiresAt: null } : {}),
      },
    });
    if (moved.count !== 1) return { ok: false, error: "conflict" } as const;

    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        from,
        to,
        changedById: input.actorId,
        note: input.note,
      },
    });
    if (to === "PAID") {
      // Cash on delivery: the admin confirmed the order with the customer.
      await tx.payment.updateMany({
        where: { orderId: input.orderId, provider: "COD", status: "PENDING" },
        data: { status: "APPROVED" },
      });
      await addOrderToSoldCount(tx, input.orderId);
    }
    return { ok: true, from } as const;
  });
}
