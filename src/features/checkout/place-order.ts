import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  computeOrderTotals,
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_TAX_RATE,
  evaluateCoupon,
  findShippingRate,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  normalizeCouponCode,
  type CouponErrorKey,
  type CouponResult,
  type OrderTotals,
} from "./pricing";

/*
 * Server-side checkout. Takes the Prisma client as a parameter (no server-only
 * imports) so the integration tests can run it against a real database.
 * Nothing the browser sends is trusted except variant ids and quantities.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const checkoutLinesSchema = z
  .array(
    z.object({
      variantId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    }),
  )
  .min(1)
  .max(MAX_CART_LINES);

export const quoteInputSchema = z.object({
  lines: checkoutLinesSchema,
  addressId: z.uuid().nullable(),
  couponCode: z.string().max(40).default(""),
});

/** Payment methods enabled so far; card and PSE (Wompi) arrive in phase 5. */
export const PAYMENT_METHODS = ["COD"] as const;

export const placeOrderSchema = quoteInputSchema.extend({
  addressId: z.uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  acceptTerms: z.literal(true),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  sku: string;
  name: { es: string; en: string };
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  stock: number;
}

export type LineIssue =
  | { variantId: string; reason: "unavailable" }
  | { variantId: string; reason: "insufficientStock"; stock: number };

// A type alias (not an interface) so it is assignable to Prisma JSON input.
export type ShippingAddressSnapshot = {
  label: string;
  recipient: string;
  phone: string;
  department: string;
  city: string;
  line1: string;
  line2: string | null;
  notes: string | null;
};

export interface Quote {
  lines: QuoteLine[];
  issues: LineIssue[];
  totals: OrderTotals;
  coupon: CouponResult | null;
  couponId: string | null;
  address: ShippingAddressSnapshot | null;
  shippingEtaDays: number | null;
  taxRate: number;
}

async function readSettings(db: Db) {
  const rows = await db.setting.findMany({
    where: { key: { in: ["freeShippingThreshold", "taxRate"] } },
  });
  const read = (key: string, fallback: number) => {
    const value = Number(rows.find((row) => row.key === key)?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    freeShippingThreshold: read("freeShippingThreshold", DEFAULT_FREE_SHIPPING_THRESHOLD),
    taxRate: read("taxRate", DEFAULT_TAX_RATE),
  };
}

/** Sums repeated variants so a crafted payload cannot bypass per-line limits. */
function mergeLines(lines: QuoteInput["lines"]) {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...merged].map(([variantId, quantity]) => ({
    variantId,
    quantity: Math.min(quantity, MAX_LINE_QUANTITY),
  }));
}

/** Prices, stock, shipping, coupon and VAT computed from the database. */
export async function buildQuote(
  db: Db,
  userId: string,
  input: QuoteInput,
  now = new Date(),
): Promise<Quote> {
  const requested = mergeLines(input.lines);
  const code = input.couponCode ? normalizeCouponCode(input.couponCode) : null;

  const [variants, settings, address, rates, coupon] = await Promise.all([
    db.productVariant.findMany({
      where: { id: { in: requested.map((line) => line.variantId) } },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        stock: true,
        priceOverride: true,
        product: {
          select: {
            id: true,
            slug: true,
            nameEs: true,
            nameEn: true,
            price: true,
            isActive: true,
            images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    }),
    readSettings(db),
    input.addressId
      ? db.address.findFirst({ where: { id: input.addressId, userId } })
      : Promise.resolve(null),
    db.shippingRate.findMany({ select: { city: true, price: true, etaDays: true } }),
    code ? db.coupon.findUnique({ where: { code } }) : Promise.resolve(null),
  ]);

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const lines: QuoteLine[] = [];
  const issues: LineIssue[] = [];

  for (const { variantId, quantity } of requested) {
    const variant = byId.get(variantId);
    if (!variant || !variant.product.isActive || variant.stock <= 0) {
      issues.push({ variantId, reason: "unavailable" });
      continue;
    }
    if (variant.stock < quantity) {
      issues.push({ variantId, reason: "insufficientStock", stock: variant.stock });
    }
    lines.push({
      variantId,
      productId: variant.product.id,
      slug: variant.product.slug,
      sku: variant.sku,
      name: { es: variant.product.nameEs, en: variant.product.nameEn },
      size: variant.size,
      color: variant.color,
      imageUrl: variant.product.images[0]?.url ?? null,
      unitPrice: variant.priceOverride ?? variant.product.price,
      quantity: Math.min(quantity, variant.stock),
      stock: variant.stock,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let couponResult: CouponResult | null = null;
  if (input.couponCode.trim()) {
    const usedByUser = coupon
      ? (await db.couponRedemption.count({ where: { couponId: coupon.id, userId } })) > 0
      : false;
    couponResult = code
      ? evaluateCoupon(coupon, { subtotal, now, usedByUser })
      : { ok: false, error: "invalid" };
  }

  const rate = address ? findShippingRate(rates, address.city) : null;
  const totals = computeOrderTotals({
    lines,
    discount: couponResult?.ok ? couponResult.discount : 0,
    shippingPrice: rate?.price ?? 0,
    freeShippingThreshold: settings.freeShippingThreshold,
    taxRate: settings.taxRate,
  });

  return {
    lines,
    issues,
    totals,
    coupon: couponResult,
    couponId: couponResult?.ok && coupon ? coupon.id : null,
    address: address
      ? {
          label: address.label,
          recipient: address.recipient,
          phone: address.phone,
          department: address.department,
          city: address.city,
          line1: address.line1,
          line2: address.line2,
          notes: address.notes,
        }
      : null,
    shippingEtaDays: rate?.etaDays ?? null,
    taxRate: settings.taxRate,
  };
}

/** Translation keys under "Checkout.errors". */
export type PlaceOrderError = "cartChanged" | "outOfStock" | "coupon" | "address" | "generic";

export type PlaceOrderResult =
  | { ok: true; orderId: string; number: string }
  | {
      ok: false;
      error: PlaceOrderError;
      issues?: LineIssue[];
      couponError?: CouponErrorKey;
    };

class CheckoutAbort extends Error {
  constructor(readonly result: Extract<PlaceOrderResult, { ok: false }>) {
    super(result.error);
  }
}

/**
 * Creates a PENDING order in one transaction:
 * 1. Recomputes the quote from the database (no client amounts).
 * 2. Reserves stock with a conditional UPDATE per variant (stock >= quantity),
 *    in id order to avoid deadlocks. Concurrent buyers of the last unit: one
 *    UPDATE matches, the others match 0 rows and roll back. No oversell.
 * 3. Claims the coupon with a conditional increment (respects maxUses).
 * 4. Inserts order, items, status history, payment attempt and redemption.
 * Any failure throws inside the transaction, so nothing is half-written.
 */
export async function placeOrder(
  db: PrismaClient,
  userId: string,
  input: PlaceOrderInput,
  options: { expiresInMinutes: number; termsVersion: string; now?: Date },
): Promise<PlaceOrderResult> {
  const now = options.now ?? new Date();
  try {
    const order = await db.$transaction(
      async (tx) => {
        const quote = await buildQuote(tx, userId, input, now);
        if (!quote.address) throw new CheckoutAbort({ ok: false, error: "address" });
        if (quote.issues.length > 0 || quote.lines.length === 0) {
          throw new CheckoutAbort({ ok: false, error: "cartChanged", issues: quote.issues });
        }
        if (quote.coupon && !quote.coupon.ok) {
          throw new CheckoutAbort({ ok: false, error: "coupon", couponError: quote.coupon.error });
        }

        const reservation = [...quote.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
        for (const line of reservation) {
          const updated = await tx.$executeRaw`
            UPDATE "ProductVariant" SET stock = stock - ${line.quantity}
            WHERE id = ${line.variantId}::uuid AND stock >= ${line.quantity}`;
          if (updated === 0) {
            throw new CheckoutAbort({
              ok: false,
              error: "outOfStock",
              issues: [{ variantId: line.variantId, reason: "unavailable" }],
            });
          }
        }

        if (quote.couponId) {
          const claimed = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
            WHERE id = ${quote.couponId}::uuid AND "isActive"
              AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
          if (claimed === 0) {
            throw new CheckoutAbort({ ok: false, error: "coupon", couponError: "exhausted" });
          }
        }

        const [numbered] = await tx.$queryRaw<{ number: string }[]>`
          SELECT public.next_order_number() AS number`;
        if (!numbered) throw new Error("next_order_number() returned no row");
        const { number } = numbered;
        const { totals } = quote;

        return tx.order.create({
          data: {
            number,
            userId,
            status: "PENDING",
            paymentMethod: input.paymentMethod,
            subtotal: totals.subtotal,
            discount: totals.discount,
            shippingCost: totals.shippingCost,
            taxBase: totals.taxBase,
            taxAmount: totals.taxAmount,
            total: totals.total,
            couponCode: quote.coupon?.ok ? quote.coupon.code : null,
            shippingAddress: quote.address satisfies ShippingAddressSnapshot,
            termsAcceptedAt: now,
            termsVersion: options.termsVersion,
            expiresAt: new Date(now.getTime() + options.expiresInMinutes * 60_000),
            items: {
              create: quote.lines.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                productName: line.name.es,
                size: line.size,
                color: line.color,
                imageUrl: line.imageUrl,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                lineTotal: line.unitPrice * line.quantity,
              })),
            },
            statusHistory: { create: { to: "PENDING", changedById: userId } },
            payments: {
              create: {
                provider: "COD",
                reference: `${number}-A1`,
                method: input.paymentMethod,
                amountInCents: BigInt(totals.total) * 100n,
              },
            },
            ...(quote.couponId
              ? { redemption: { create: { couponId: quote.couponId, userId } } }
              : {}),
          },
          select: { id: true, number: true },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    return { ok: true, orderId: order.id, number: order.number };
  } catch (error) {
    if (error instanceof CheckoutAbort) return error.result;
    console.error("[checkout] order transaction failed", error);
    return { ok: false, error: "generic" };
  }
}

/** Cancels an order through the SQL function (idempotent; releases stock and coupon). */
export async function cancelOrder(db: Db, orderId: string, actorId: string | null, note: string) {
  const [row] = await db.$queryRaw<{ cancelled: boolean }[]>`
    SELECT public.cancel_order(${orderId}::uuid, ${actorId}::uuid, ${note}) AS cancelled`;
  return row?.cancelled ?? false;
}
