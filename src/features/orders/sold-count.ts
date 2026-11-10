import type { Prisma } from "@prisma/client";

/**
 * Adds an order's units to its products' soldCount (used for "best sellers").
 * Called once, inside the transaction that moves the order to PAID; the
 * reverse happens in the cancel_order() SQL function.
 */
export async function addOrderToSoldCount(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$executeRaw`
    UPDATE "Product" p SET "soldCount" = p."soldCount" + sold.quantity
    FROM (
      SELECT "productId", sum(quantity)::int AS quantity
      FROM "OrderItem" WHERE "orderId" = ${orderId}::uuid
      GROUP BY "productId"
    ) sold
    WHERE p.id = sold."productId"`;
}
