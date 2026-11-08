import "server-only";
import { getDb } from "@/lib/db";
import type { ShippingAddressSnapshot } from "@/features/checkout/place-order";

const orderDetailSelect = {
  id: true,
  number: true,
  userId: true,
  status: true,
  paymentMethod: true,
  subtotal: true,
  discount: true,
  shippingCost: true,
  taxBase: true,
  taxAmount: true,
  total: true,
  couponCode: true,
  shippingAddress: true,
  expiresAt: true,
  createdAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productName: true,
      size: true,
      color: true,
      imageUrl: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      variant: {
        select: { sku: true, product: { select: { slug: true, nameEs: true, nameEn: true } } },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" },
    select: { id: true, from: true, to: true, note: true, createdAt: true },
  },
} as const;

export async function getUserOrders(userId: string) {
  return getDb().order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      number: true,
      status: true,
      paymentMethod: true,
      total: true,
      createdAt: true,
      items: { select: { quantity: true } },
    },
  });
}

/** An order by number, only if it belongs to the user (or for admins, any order). */
export async function getOrderForViewer(number: string, viewer: { id: string; isAdmin: boolean }) {
  const order = await getDb().order.findUnique({ where: { number }, select: orderDetailSelect });
  if (!order || (order.userId !== viewer.id && !viewer.isAdmin)) return null;
  return {
    ...order,
    shippingAddress: order.shippingAddress as unknown as ShippingAddressSnapshot,
    items: order.items.map(({ variant, ...item }) => ({
      ...item,
      sku: variant.sku,
      slug: variant.product.slug,
      // Snapshot name is Spanish; show the live translated name when it still exists.
      name: {
        es: variant.product.nameEs || item.productName,
        en: variant.product.nameEn || item.productName,
      },
    })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderForViewer>>>;

export async function isAdminUser(userId: string): Promise<boolean> {
  const profile = await getDb().profile.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return profile?.role === "ADMIN";
}
