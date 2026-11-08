import type { Locale } from "@/i18n/routing";
import type { EmailMessage } from "./send";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Shared table-based layout with inline styles (email clients ignore stylesheets). */
function layout({ preheader, body, locale }: { preheader: string; body: string; locale: Locale }) {
  const footer =
    locale === "es"
      ? "CamiloShop es un proyecto de portafolio. No se realizan ventas reales."
      : "CamiloShop is a portfolio project. No real sales are made.";

  return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CamiloShop</title></head>
<body style="margin:0;padding:0;background:#0b0f19;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f8fafc">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2937;border-radius:16px">
<tr><td style="padding:28px 32px 0;font-size:22px;font-weight:700">Camilo<span style="color:#a78bfa">Shop</span></td></tr>
<tr><td style="padding:20px 32px 32px;font-size:15px;line-height:1.6;color:#e5e7eb">${body}</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#9ca3af">${escapeHtml(footer)}</p>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;padding:12px 24px;border-radius:999px;background:#7c3aed;color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>`;
}

export function welcomeEmail({
  to,
  name,
  locale,
  siteUrl,
}: {
  to: string;
  name: string | null;
  locale: Locale;
  siteUrl: string;
}): EmailMessage {
  const shopUrl = `${siteUrl}/${locale}`;
  const copy =
    locale === "es"
      ? {
          subject: "Bienvenido a CamiloShop",
          greeting: name ? `Hola, ${name}:` : "Hola:",
          intro:
            "Tu cuenta quedó lista. Ya puedes guardar favoritos, administrar tus direcciones y seguir tus pedidos.",
          cta: "Ir a la tienda",
        }
      : {
          subject: "Welcome to CamiloShop",
          greeting: name ? `Hi ${name},` : "Hi,",
          intro:
            "Your account is ready. You can now save favorites, manage your addresses and track your orders.",
          cta: "Go to the store",
        };

  const html = layout({
    locale,
    preheader: copy.intro,
    body: `<p style="margin:0 0 12px">${escapeHtml(copy.greeting)}</p><p style="margin:0 0 20px">${escapeHtml(copy.intro)}</p>${button(shopUrl, copy.cta)}`,
  });

  return {
    to,
    subject: copy.subject,
    html,
    text: `${copy.greeting}\n\n${copy.intro}\n\n${copy.cta}: ${shopUrl}`,
  };
}

export interface OrderEmailData {
  number: string;
  paymentMethod: "CARD" | "PSE" | "COD";
  items: { name: string; variant: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  taxBase: number;
  taxAmount: number;
  total: number;
  address: {
    recipient: string;
    line1: string;
    line2: string | null;
    city: string;
    department: string;
  };
}

function cop(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const ORDER_COPY = {
  es: {
    subject: (number: string) => `Recibimos tu pedido ${number}`,
    greeting: (name: string | null) => (name ? `Hola, ${name}:` : "Hola:"),
    intro: (number: string) => `Recibimos tu pedido ${number}. Este es el resumen.`,
    cod: "Pago contra entrega: confirmaremos tu pedido y pagarás al recibirlo.",
    online: "Te avisaremos cuando confirmemos el pago.",
    subtotal: "Subtotal",
    discount: "Descuento",
    shipping: "Envío",
    free: "Gratis",
    taxBase: "Base gravable",
    tax: "IVA 19 %",
    total: "Total",
    shipTo: "Enviar a",
    cta: "Ver mi pedido",
    receipt: "El comprobante de compra no es una factura electrónica DIAN.",
  },
  en: {
    subject: (number: string) => `We received your order ${number}`,
    greeting: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    intro: (number: string) => `We received your order ${number}. Here is the summary.`,
    cod: "Cash on delivery: we'll confirm your order and you'll pay when it arrives.",
    online: "We'll let you know once the payment is confirmed.",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    free: "Free",
    taxBase: "Taxable base",
    tax: "VAT 19%",
    total: "Total",
    shipTo: "Ship to",
    cta: "View my order",
    receipt: "The purchase receipt is not a DIAN electronic invoice.",
  },
} as const;

export function orderConfirmationEmail({
  to,
  name,
  locale,
  siteUrl,
  order,
}: {
  to: string;
  name: string | null;
  locale: Locale;
  siteUrl: string;
  order: OrderEmailData;
}): EmailMessage {
  const copy = ORDER_COPY[locale];
  const orderUrl = `${siteUrl}/${locale}/account/orders/${encodeURIComponent(order.number)}`;
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:#9ca3af">${escapeHtml(label)}</td><td align="right" style="padding:4px 0;${strong ? "font-weight:700;color:#f8fafc;font-size:17px" : ""}">${escapeHtml(value)}</td></tr>`;

  const items = order.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #1f2937">${escapeHtml(item.name)}${item.variant ? `<br><span style="font-size:13px;color:#9ca3af">${escapeHtml(item.variant)}</span>` : ""}<br><span style="font-size:13px;color:#9ca3af">× ${item.quantity}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #1f2937">${escapeHtml(cop(item.lineTotal, locale))}</td></tr>`,
    )
    .join("");

  const totals = [
    row(copy.subtotal, cop(order.subtotal, locale)),
    order.discount > 0
      ? row(
          `${copy.discount}${order.couponCode ? ` (${order.couponCode})` : ""}`,
          `-${cop(order.discount, locale)}`,
        )
      : "",
    row(copy.shipping, order.shippingCost === 0 ? copy.free : cop(order.shippingCost, locale)),
    row(copy.taxBase, cop(order.taxBase, locale)),
    row(copy.tax, cop(order.taxAmount, locale)),
    row(copy.total, cop(order.total, locale), true),
  ].join("");

  const address = [
    order.address.recipient,
    [order.address.line1, order.address.line2].filter(Boolean).join(", "),
    `${order.address.city}, ${order.address.department}`,
  ];

  const body = `<p style="margin:0 0 12px">${escapeHtml(copy.greeting(name))}</p>
<p style="margin:0 0 8px">${escapeHtml(copy.intro(order.number))}</p>
<p style="margin:0 0 20px;color:#67e8f9">${escapeHtml(order.paymentMethod === "COD" ? copy.cod : copy.online)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${items}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:14px">${totals}</table>
<p style="margin:20px 0 4px;font-weight:600">${escapeHtml(copy.shipTo)}</p>
<p style="margin:0 0 20px;color:#9ca3af">${address.map(escapeHtml).join("<br>")}</p>
${button(orderUrl, copy.cta)}
<p style="margin:20px 0 0;font-size:12px;color:#9ca3af">${escapeHtml(copy.receipt)}</p>`;

  const text = [
    copy.greeting(name),
    "",
    copy.intro(order.number),
    order.paymentMethod === "COD" ? copy.cod : copy.online,
    "",
    ...order.items.map(
      (item) =>
        `${item.quantity} × ${item.name}${item.variant ? ` (${item.variant})` : ""}: ${cop(item.lineTotal, locale)}`,
    ),
    "",
    `${copy.total}: ${cop(order.total, locale)} (${copy.tax}: ${cop(order.taxAmount, locale)})`,
    `${copy.cta}: ${orderUrl}`,
  ].join("\n");

  return {
    to,
    subject: copy.subject(order.number),
    html: layout({ locale, preheader: copy.intro(order.number), body }),
    text,
  };
}

export type NotifiedStatus = "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const STATUS_COPY = {
  es: {
    PAID: {
      subject: "Pago confirmado",
      text: "Confirmamos el pago de tu pedido. Pronto lo prepararemos para el envío.",
    },
    SHIPPED: {
      subject: "Tu pedido va en camino",
      text: "Tu pedido salió de nuestra bodega y va en camino.",
    },
    DELIVERED: {
      subject: "Pedido entregado",
      text: "Tu pedido fue entregado. Ya puedes dejar una reseña de tus productos.",
    },
    CANCELLED: {
      subject: "Pedido cancelado",
      text: "Tu pedido fue cancelado y los productos volvieron al inventario.",
    },
    greeting: (name: string | null) => (name ? `Hola, ${name}:` : "Hola:"),
    order: "Pedido",
    total: "Total",
    cta: "Ver mi pedido",
  },
  en: {
    PAID: {
      subject: "Payment confirmed",
      text: "We confirmed the payment for your order. We'll prepare it for shipping soon.",
    },
    SHIPPED: {
      subject: "Your order is on its way",
      text: "Your order left our warehouse and is on its way.",
    },
    DELIVERED: {
      subject: "Order delivered",
      text: "Your order was delivered. You can now review your products.",
    },
    CANCELLED: {
      subject: "Order cancelled",
      text: "Your order was cancelled and the products went back to stock.",
    },
    greeting: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    order: "Order",
    total: "Total",
    cta: "View my order",
  },
} as const;

export function orderStatusEmail({
  to,
  name,
  locale,
  siteUrl,
  number,
  total,
  status,
}: {
  to: string;
  name: string | null;
  locale: Locale;
  siteUrl: string;
  number: string;
  total: number;
  status: NotifiedStatus;
}): EmailMessage {
  const copy = STATUS_COPY[locale];
  const { subject, text } = copy[status];
  const orderUrl = `${siteUrl}/${locale}/account/orders/${encodeURIComponent(number)}`;
  const body = `<p style="margin:0 0 12px">${escapeHtml(copy.greeting(name))}</p>
<p style="margin:0 0 16px">${escapeHtml(text)}</p>
<p style="margin:0 0 20px;color:#9ca3af">${escapeHtml(copy.order)} <strong style="color:#f8fafc">${escapeHtml(number)}</strong> · ${escapeHtml(copy.total)} ${escapeHtml(cop(total, locale))}</p>
${button(orderUrl, copy.cta)}`;

  return {
    to,
    subject: `${subject} · ${number}`,
    html: layout({ locale, preheader: text, body }),
    text: `${copy.greeting(name)}\n\n${text}\n\n${copy.order} ${number} · ${copy.total} ${cop(total, locale)}\n${copy.cta}: ${orderUrl}`,
  };
}
