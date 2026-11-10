import type { OrderStatusValue } from "@/features/orders/status";

export type PaymentMethodValue = "CARD" | "PSE" | "COD";

/**
 * Status changes an admin may make by hand. Same state machine as the store
 * (PENDING -> PAID -> SHIPPED -> DELIVERED, CANCELLED from PENDING or PAID),
 * with one restriction: a card/PSE order becomes PAID only through the payment
 * gateway, never by hand. Cash on delivery is marked PAID when the admin
 * confirms it with the customer.
 */
export function adminTransitions(
  status: OrderStatusValue,
  method: PaymentMethodValue,
): OrderStatusValue[] {
  switch (status) {
    case "PENDING":
      return method === "COD" ? ["PAID", "CANCELLED"] : ["CANCELLED"];
    case "PAID":
      return ["SHIPPED", "CANCELLED"];
    case "SHIPPED":
      return ["DELIVERED"];
    default:
      return [];
  }
}
