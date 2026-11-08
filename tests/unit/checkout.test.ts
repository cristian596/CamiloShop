import { describe, expect, it } from "vitest";
import {
  computeOrderTotals,
  couponDiscount,
  evaluateCoupon,
  findShippingRate,
  normalizeCity,
  normalizeCouponCode,
  splitIncludedTax,
  type CouponRow,
} from "@/features/checkout/pricing";
import { canCustomerCancel, canTransition, ORDER_STATUSES } from "@/features/orders/status";

describe("VAT included", () => {
  it("splits the total so base + VAT is exact", () => {
    expect(splitIncludedTax(119_000)).toEqual({ taxBase: 100_000, taxAmount: 19_000 });
    for (const total of [1, 99, 9_900, 489_900, 1_234_567]) {
      const { taxBase, taxAmount } = splitIncludedTax(total);
      expect(taxBase + taxAmount).toBe(total);
      expect(Math.abs(taxAmount - total * (0.19 / 1.19))).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("shipping", () => {
  const rates = [
    { city: "Bogotá", price: 9_900, etaDays: 2 },
    { city: "Medellín", price: 11_900, etaDays: 3 },
    { city: "DEFAULT", price: 16_900, etaDays: 6 },
  ];

  it("matches cities ignoring accents, case and D.C.", () => {
    expect(normalizeCity("  Bogotá D.C. ")).toBe("bogota");
    expect(findShippingRate(rates, "bogota")?.price).toBe(9_900);
    expect(findShippingRate(rates, "MEDELLIN")?.price).toBe(11_900);
    expect(findShippingRate(rates, "Envigado")?.price).toBe(16_900);
  });

  it("is free from $200.000 after discounts", () => {
    const base = { shippingPrice: 9_900, freeShippingThreshold: 200_000, taxRate: 0.19 };
    const below = computeOrderTotals({
      ...base,
      lines: [{ unitPrice: 199_999, quantity: 1 }],
      discount: 0,
    });
    expect(below.shippingCost).toBe(9_900);
    expect(below.remainingForFreeShipping).toBe(1);

    const exact = computeOrderTotals({
      ...base,
      lines: [{ unitPrice: 100_000, quantity: 2 }],
      discount: 0,
    });
    expect(exact).toMatchObject({ shippingCost: 0, freeShipping: true, total: 200_000 });

    // A coupon that drops the merchandise below the threshold brings shipping back.
    const discounted = computeOrderTotals({
      ...base,
      lines: [{ unitPrice: 210_000, quantity: 1 }],
      discount: 21_000,
    });
    expect(discounted).toMatchObject({ shippingCost: 9_900, total: 198_900 });
    expect(discounted.taxBase + discounted.taxAmount).toBe(discounted.total);
  });

  it("charges nothing for an empty cart", () => {
    const totals = computeOrderTotals({
      lines: [],
      discount: 0,
      shippingPrice: 9_900,
      freeShippingThreshold: 200_000,
      taxRate: 0.19,
    });
    expect(totals.total).toBe(0);
  });
});

describe("coupons", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const coupon: CouponRow = {
    code: "CLAUDE10",
    type: "PERCENT",
    value: 10,
    isActive: true,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    usedCount: 0,
    minSubtotal: 0,
  };

  it("normalizes codes", () => {
    expect(normalizeCouponCode(" claude10 ")).toBe("CLAUDE10");
    expect(normalizeCouponCode("x")).toBeNull();
    expect(normalizeCouponCode("DROP TABLE")).toBeNull();
  });

  it("computes percent and fixed discounts without over-discounting", () => {
    expect(couponDiscount("PERCENT", 10, 99_999)).toBe(9_999);
    expect(couponDiscount("PERCENT", 5, 489_900)).toBe(24_495);
    expect(couponDiscount("FIXED", 50_000, 30_000)).toBe(30_000);
  });

  it("applies a valid coupon", () => {
    expect(evaluateCoupon(coupon, { subtotal: 100_000, now, usedByUser: false })).toEqual({
      ok: true,
      code: "CLAUDE10",
      discount: 10_000,
    });
  });

  it.each([
    ["unknown", null, "invalid"],
    ["inactive", { ...coupon, isActive: false }, "inactive"],
    ["future", { ...coupon, startsAt: new Date("2026-12-01") }, "notStarted"],
    ["expired", { ...coupon, endsAt: new Date("2026-11-01") }, "expired"],
    ["exhausted", { ...coupon, maxUses: 5, usedCount: 5 }, "exhausted"],
    ["below minimum", { ...coupon, minSubtotal: 150_000 }, "minSubtotal"],
  ] as const)("rejects an %s coupon", (_label, row, error) => {
    const result = evaluateCoupon(row, { subtotal: 100_000, now, usedByUser: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(error);
  });

  it("rejects a coupon the user already redeemed", () => {
    const result = evaluateCoupon(coupon, { subtotal: 100_000, now, usedByUser: true });
    expect(result.ok || result.error).toBe("alreadyUsed");
  });
});

describe("order state machine", () => {
  it("follows PENDING -> PAID -> SHIPPED -> DELIVERED", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PAID", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "PAID")).toBe(false);
  });

  it("cancels only from PENDING or PAID, and customers only from PENDING", () => {
    const cancellable = ORDER_STATUSES.filter((status) => canTransition(status, "CANCELLED"));
    expect(cancellable).toEqual(["PENDING", "PAID"]);
    expect(ORDER_STATUSES.filter(canCustomerCancel)).toEqual(["PENDING"]);
  });
});
