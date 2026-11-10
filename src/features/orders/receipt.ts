import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Locale } from "@/i18n/routing";

/**
 * Purchase receipt as PDF, built with pdf-lib (pure JS, no native dependencies).
 * It is explicitly NOT a DIAN electronic invoice.
 */

export interface ReceiptData {
  number: string;
  createdAt: Date;
  status: string;
  paymentMethod: string;
  customer: { name: string; email: string };
  address: {
    recipient: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    department: string;
  };
  items: {
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  taxBase: number;
  taxAmount: number;
  total: number;
}

const COPY = {
  es: {
    title: "Comprobante de compra",
    notInvoice: "Este documento NO es una factura electrónica de venta ante la DIAN.",
    order: "Pedido",
    date: "Fecha",
    status: "Estado",
    payment: "Pago",
    customer: "Cliente",
    shipTo: "Envío a",
    product: "Producto",
    qty: "Cant.",
    unit: "Precio",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Descuento",
    shipping: "Envío",
    free: "Gratis",
    taxBase: "Base gravable",
    tax: "IVA 19 %",
    vatNote: "Todos los precios incluyen IVA. Montos en pesos colombianos (COP).",
    footer: "CamiloShop · Proyecto de portafolio · Pagos en modo sandbox, sin cobros reales.",
  },
  en: {
    title: "Purchase receipt",
    notInvoice: "This document is NOT a DIAN electronic sales invoice.",
    order: "Order",
    date: "Date",
    status: "Status",
    payment: "Payment",
    customer: "Customer",
    shipTo: "Ship to",
    product: "Product",
    qty: "Qty",
    unit: "Price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    free: "Free",
    taxBase: "Taxable base",
    tax: "VAT 19%",
    vatNote: "All prices include VAT. Amounts in Colombian pesos (COP).",
    footer: "CamiloShop · Portfolio project · Sandbox payments, no real charges.",
  },
} as const;

/** Standard PDF fonts use WinAnsi; anything outside it (emoji, CJK) becomes "?". */
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
export function toWinAnsi(text: string): string {
  return [...text.normalize("NFC")]
    .map((char) => (char.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(char) ? char : "?"))
    .join("")
    .replace(/[\u0000-\u001f]/g, " ");
}

function money(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/ /g, " ");
}

/** Cuts text to fit a width, adding "…" when shortened. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = toWinAnsi(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}…`;
}

export async function buildReceiptPdf(
  data: ReceiptData,
  locale: Locale,
  labels: { status: string; payment: string },
) {
  const copy = COPY[locale];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${copy.title} ${data.number}`);
  pdf.setAuthor("CamiloShop");
  pdf.setCreationDate(new Date());

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const violet = rgb(0.486, 0.227, 0.929);
  const muted = rgb(0.4, 0.42, 0.47);
  const dark = rgb(0.07, 0.09, 0.15);

  const width = 595.28; // A4
  const height = 841.89;
  const margin = 48;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;

  const text = (value: string, x: number, size = 10, font = regular, color = dark) =>
    page.drawText(toWinAnsi(value), { x, y, size, font, color });
  const right = (value: string, xRight: number, size = 10, font = regular, color = dark) => {
    const safe = toWinAnsi(value);
    page.drawText(safe, { x: xRight - font.widthOfTextAtSize(safe, size), y, size, font, color });
  };
  const rule = () => {
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.6,
      color: rgb(0.85, 0.86, 0.9),
    });
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 40) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
  };

  // Header
  text("Camilo", margin, 22, bold);
  page.drawText("Shop", {
    x: margin + bold.widthOfTextAtSize("Camilo", 22),
    y,
    size: 22,
    font: bold,
    color: violet,
  });
  right(copy.title, width - margin, 14, bold);
  y -= 18;
  right(copy.notInvoice, width - margin, 8.5, bold, rgb(0.75, 0.1, 0.36));
  y -= 28;

  // Order and customer
  const dateText = new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(data.createdAt);
  const meta: [string, string][] = [
    [copy.order, data.number],
    [copy.date, dateText],
    [copy.status, labels.status],
    [copy.payment, labels.payment],
  ];
  const addressLines = [
    data.customer.name,
    data.customer.email,
    `${data.address.recipient} · ${data.address.phone}`,
    [data.address.line1, data.address.line2].filter(Boolean).join(", "),
    `${data.address.city}, ${data.address.department}`,
  ];
  const top = y;
  for (const [label, value] of meta) {
    text(label, margin, 9, regular, muted);
    text(value, margin + 70, 10, label === copy.order ? bold : regular);
    y -= 15;
  }
  y = top;
  text(`${copy.customer} / ${copy.shipTo}`, 320, 9, regular, muted);
  y -= 15;
  for (const line of addressLines) {
    page.drawText(fit(line, regular, 10, width - margin - 320), {
      x: 320,
      y,
      size: 10,
      font: regular,
      color: dark,
    });
    y -= 14;
  }
  y = Math.min(y, top - meta.length * 15) - 18;

  // Items table
  const colQty = 360;
  const colUnit = 450;
  const colTotal = width - margin;
  text(copy.product, margin, 9, bold, muted);
  right(copy.qty, colQty, 9, bold, muted);
  right(copy.unit, colUnit, 9, bold, muted);
  right(copy.total, colTotal, 9, bold, muted);
  y -= 8;
  rule();
  y -= 16;

  for (const item of data.items) {
    ensureSpace(30);
    page.drawText(fit(item.name, regular, 10, colQty - margin - 40), {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: dark,
    });
    right(String(item.quantity), colQty);
    right(money(item.unitPrice, locale), colUnit);
    right(money(item.lineTotal, locale), colTotal);
    if (item.variant) {
      y -= 12;
      page.drawText(fit(item.variant, regular, 8.5, colQty - margin - 40), {
        x: margin,
        y,
        size: 8.5,
        font: regular,
        color: muted,
      });
    }
    y -= 18;
  }
  rule();
  y -= 20;

  // Totals
  ensureSpace(140);
  const totals: [string, string, boolean?][] = [
    [copy.subtotal, money(data.subtotal, locale)],
    ...(data.discount > 0
      ? [
          [
            `${copy.discount}${data.couponCode ? ` (${data.couponCode})` : ""}`,
            `-${money(data.discount, locale)}`,
          ] as [string, string],
        ]
      : []),
    [copy.shipping, data.shippingCost === 0 ? copy.free : money(data.shippingCost, locale)],
    [copy.taxBase, money(data.taxBase, locale)],
    [copy.tax, money(data.taxAmount, locale)],
    [copy.total, money(data.total, locale), true],
  ];
  for (const [label, value, strong] of totals) {
    if (strong) y -= 4;
    right(label, colUnit, strong ? 12 : 10, strong ? bold : regular, strong ? dark : muted);
    right(value, colTotal, strong ? 12 : 10, strong ? bold : regular);
    y -= strong ? 20 : 15;
  }
  y -= 10;
  text(copy.vatNote, margin, 8.5, regular, muted);

  // Footer on every page
  for (const current of pdf.getPages()) {
    current.drawText(toWinAnsi(copy.footer), {
      x: margin,
      y: margin - 16,
      size: 8,
      font: regular,
      color: muted,
    });
  }

  return pdf.save();
}
