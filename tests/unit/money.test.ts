import { describe, expect, it } from "vitest";
import { copToUsd, discountPercent, formatPrice } from "@/lib/money";

// Intl output uses non-breaking spaces; normalize them for readable assertions.
const normalize = (value: string) => value.replace(/\s/g, " ");

describe("copToUsd", () => {
  it("converts and rounds to cents", () => {
    expect(copToUsd(199_900, 4000)).toBe(49.98);
    expect(copToUsd(0, 4000)).toBe(0);
  });

  it("rejects non-positive rates", () => {
    expect(() => copToUsd(1000, 0)).toThrow(RangeError);
    expect(() => copToUsd(1000, -5)).toThrow(RangeError);
    expect(() => copToUsd(1000, Number.NaN)).toThrow(RangeError);
  });
});

describe("formatPrice", () => {
  it("formats COP without decimals in Spanish", () => {
    expect(normalize(formatPrice(1_250_000, { locale: "es" }))).toBe("$ 1.250.000");
  });

  it("formats COP in English", () => {
    expect(normalize(formatPrice(1_250_000, { locale: "en" }))).toBe("COP 1,250,000");
  });

  it("formats USD with cents", () => {
    expect(formatPrice(199_900, { locale: "en", currency: "USD", usdRate: 4000 })).toBe("$49.98");
    expect(normalize(formatPrice(199_900, { locale: "es", currency: "USD", usdRate: 4000 }))).toBe(
      "US$ 49,98",
    );
  });

  it("requires a rate for USD", () => {
    expect(() => formatPrice(1000, { locale: "es", currency: "USD" })).toThrow(RangeError);
  });
});

describe("discountPercent", () => {
  it("returns the rounded percentage", () => {
    expect(discountPercent(200_000, 150_000)).toBe(25);
    expect(discountPercent(299_900, 249_900)).toBe(17);
  });

  it("returns 0 when there is no discount", () => {
    expect(discountPercent(100_000, 100_000)).toBe(0);
    expect(discountPercent(0, 100)).toBe(0);
    expect(discountPercent(100, 120)).toBe(0);
  });
});
