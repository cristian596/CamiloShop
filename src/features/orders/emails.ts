import "server-only";
import { isColorKey } from "@/config/catalog";
import { getDb } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import {
  orderConfirmationEmail,
  orderStatusEmail,
  type NotifiedStatus,
} from "@/lib/email/templates";
import type { ShippingAddressSnapshot } from "@/features/checkout/place-order";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

const COLOR_NAMES = { es: es.Colors, en: en.Colors };

/** Sends the "order received" email. Never throws (see sendEmail). */
export async function sendOrderConfirmation(orderId: string) {
  const order = await getDb().order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      paymentMethod: true,
      subtotal: true,
      discount: true,
      couponCode: true,
      shippingCost: true,
      taxBase: true,
      taxAmount: true,
      total: true,
      shippingAddress: true,
      user: { select: { email: true, fullName: true, locale: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          productName: true,
          size: true,
          color: true,
          quantity: true,
          lineTotal: true,
          variant: { select: { product: { select: { nameEs: true, nameEn: true } } } },
        },
      },
    },
  });
  if (!order) return;

  const locale = order.user.locale === "en" ? "en" : "es";
  const address = order.shippingAddress as unknown as ShippingAddressSnapshot;

  await sendEmail(
    orderConfirmationEmail({
      to: order.user.email,
      name: order.user.fullName,
      locale,
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
      order: {
        ...order,
        address,
        items: order.items.map((item) => ({
          name:
            (locale === "en" ? item.variant.product.nameEn : item.variant.product.nameEs) ||
            item.productName,
          variant: [
            item.size,
            item.color && isColorKey(item.color) ? COLOR_NAMES[locale][item.color] : item.color,
          ]
            .filter(Boolean)
            .join(" · "),
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
    }),
  );
}

/** "Payment confirmed", "shipped", etc. Never throws (see sendEmail). */
export async function sendOrderStatusEmail(orderId: string, status: NotifiedStatus) {
  const order = await getDb().order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      total: true,
      user: { select: { email: true, fullName: true, locale: true } },
    },
  });
  if (!order) return;

  await sendEmail(
    orderStatusEmail({
      to: order.user.email,
      name: order.user.fullName,
      locale: order.user.locale === "en" ? "en" : "es",
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
      number: order.number,
      total: order.total,
      status,
    }),
  );
}
