/**
 * Pure money rules for checkout. All amounts are integer COP with VAT included;
 * the server recomputes everything from database prices before creating an order.
 */

export const DEFAULT_TAX_RATE = 0.19;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 200_000;
export const DEFAULT_SHIPPING_CITY = "DEFAULT";
export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 30;

/**
 * Splits a VAT-inclusive total into taxable base and VAT. The base is rounded
 * and the VAT takes the remainder, so base + VAT always equals the total exactly.
 */
export function splitIncludedTax(total: number, rate = DEFAULT_TAX_RATE) {
  const taxBase = Math.round(total / (1 + rate));
  return { taxBase, taxAmount: total - taxBase };
}

/** "Bogotá D.C." / "  bogota " -> "bogota", for matching cities typed by users. */
export function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\bd\.?\s*c\.?$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ShippingRateRow {
  city: string;
  price: number;
  etaDays: number;
}

/** The city's own rate, or the DEFAULT row for every other city. */
export function findShippingRate<T extends ShippingRateRow>(rates: T[], city: string): T | null {
  const wanted = normalizeCity(city);
  return (
    rates.find(
      (rate) => rate.city !== DEFAULT_SHIPPING_CITY && normalizeCity(rate.city) === wanted,
    ) ??
    rates.find((rate) => rate.city === DEFAULT_SHIPPING_CITY) ??
    null
  );
}

export type CouponType = "PERCENT" | "FIXED";

/** PERCENT rounds down (never over-discounts); FIXED never exceeds the subtotal. */
export function couponDiscount(type: CouponType, value: number, subtotal: number): number {
  if (subtotal <= 0 || value <= 0) return 0;
  if (type === "PERCENT") return Math.floor((subtotal * Math.min(value, 100)) / 100);
  return Math.min(value, subtotal);
}

export interface CouponRow {
  code: string;
  type: CouponType;
  value: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  minSubtotal: number;
}

/** Translation keys under "Checkout.couponErrors". */
export type CouponErrorKey =
  "invalid" | "inactive" | "notStarted" | "expired" | "exhausted" | "minSubtotal" | "alreadyUsed";

export type CouponResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: CouponErrorKey; minSubtotal?: number };

export function normalizeCouponCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,32}$/.test(code) ? code : null;
}

export function evaluateCoupon(
  coupon: CouponRow | null,
  context: { subtotal: number; now: Date; usedByUser: boolean },
): CouponResult {
  if (!coupon) return { ok: false, error: "invalid" };
  if (!coupon.isActive) return { ok: false, error: "inactive" };
  if (coupon.startsAt && coupon.startsAt > context.now) return { ok: false, error: "notStarted" };
  if (coupon.endsAt && coupon.endsAt <= context.now) return { ok: false, error: "expired" };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "exhausted" };
  }
  if (context.usedByUser) return { ok: false, error: "alreadyUsed" };
  if (context.subtotal < coupon.minSubtotal) {
    return { ok: false, error: "minSubtotal", minSubtotal: coupon.minSubtotal };
  }
  return {
    ok: true,
    code: coupon.code,
    discount: couponDiscount(coupon.type, coupon.value, context.subtotal),
  };
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  taxBase: number;
  taxAmount: number;
  freeShipping: boolean;
  /** How much more merchandise unlocks free shipping (0 when already free). */
  remainingForFreeShipping: number;
}

/**
 * subtotal - discount + shipping = total. Shipping is free when the discounted
 * merchandise reaches the threshold. VAT is included in every amount, shipping too.
 */
export function computeOrderTotals(input: {
  lines: { unitPrice: number; quantity: number }[];
  discount: number;
  shippingPrice: number;
  freeShippingThreshold: number;
  taxRate: number;
}): OrderTotals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Math.min(Math.max(input.discount, 0), subtotal);
  const merchandise = subtotal - discount;
  const freeShipping = merchandise >= input.freeShippingThreshold;
  const shippingCost = subtotal === 0 || freeShipping ? 0 : input.shippingPrice;
  const total = merchandise + shippingCost;

  return {
    subtotal,
    discount,
    shippingCost,
    total,
    ...splitIncludedTax(total, input.taxRate),
    freeShipping,
    remainingForFreeShipping: freeShipping ? 0 : input.freeShippingThreshold - merchandise,
  };
}
