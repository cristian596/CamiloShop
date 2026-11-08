/** Mirrors the OrderStatus enum without importing the Prisma client into client code. */
export const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/**
 * One state machine for every payment method: PENDING -> PAID -> SHIPPED ->
 * DELIVERED, and CANCELLED from PENDING or PAID (stock and coupon are released).
 */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Customers may cancel only while nothing has been paid or shipped. */
export function canCustomerCancel(status: OrderStatusValue): boolean {
  return status === "PENDING";
}

/** Progress steps shown on the order page (CANCELLED is shown separately). */
export const ORDER_PROGRESS: readonly OrderStatusValue[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
];
