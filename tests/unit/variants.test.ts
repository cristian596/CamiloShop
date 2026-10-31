import { describe, expect, it } from "vitest";
import {
  applySelection,
  findVariant,
  getDefaultSelection,
  getVariantAxes,
  isOptionAvailable,
  selectionFromSku,
  type VariantOption,
} from "@/features/catalog/variants";

function variant(size: string | null, color: string | null, stock: number): VariantOption {
  return {
    id: `${size}-${color}`,
    sku: `SKU-${size}-${color}`,
    size,
    color,
    colorHex: null,
    priceOverride: null,
    stock,
  };
}

// M/black is sold out, L only exists in white.
const shirt = [
  variant("M", "white", 3),
  variant("M", "black", 0),
  variant("S", "black", 5),
  variant("S", "white", 2),
  variant("L", "white", 1),
];

describe("getVariantAxes", () => {
  it("returns sizes in size order and colors in first-seen order", () => {
    expect(getVariantAxes(shirt)).toEqual({ sizes: ["S", "M", "L"], colors: ["white", "black"] });
  });

  it("ignores missing axes", () => {
    expect(getVariantAxes([variant(null, null, 1)])).toEqual({ sizes: [], colors: [] });
  });
});

describe("getDefaultSelection", () => {
  it("picks the first in-stock variant in display order", () => {
    expect(getDefaultSelection(shirt)).toEqual({ size: "S", color: "white" });
  });

  it("falls back to the first variant when everything is sold out", () => {
    const soldOut = [variant("M", "red", 0), variant("S", "red", 0)];
    expect(getDefaultSelection(soldOut)).toEqual({ size: "S", color: "red" });
  });

  it("handles single-variant products", () => {
    expect(getDefaultSelection([variant(null, null, 4)])).toEqual({ size: null, color: null });
  });
});

describe("isOptionAvailable", () => {
  it("considers the other axis", () => {
    expect(isOptionAvailable(shirt, "color", "black", { size: "M", color: "white" })).toBe(false);
    expect(isOptionAvailable(shirt, "color", "black", { size: "S", color: "white" })).toBe(true);
    expect(isOptionAvailable(shirt, "size", "L", { size: "S", color: "black" })).toBe(false);
  });

  it("only needs some in-stock match when the other axis is empty", () => {
    expect(isOptionAvailable(shirt, "size", "M", { size: null, color: null })).toBe(true);
  });
});

describe("applySelection", () => {
  it("keeps the other axis when the combination exists", () => {
    expect(applySelection(shirt, { size: "S", color: "black" }, "size", "M")).toEqual({
      size: "M",
      color: "black",
    });
  });

  it("falls back to an existing in-stock combination", () => {
    expect(applySelection(shirt, { size: "S", color: "black" }, "size", "L")).toEqual({
      size: "L",
      color: "white",
    });
  });
});

describe("findVariant and selectionFromSku", () => {
  it("finds the exact variant", () => {
    expect(findVariant(shirt, { size: "S", color: "black" })?.stock).toBe(5);
    expect(findVariant(shirt, { size: "L", color: "black" })).toBeUndefined();
  });

  it("reads a selection from a SKU and ignores unknown ones", () => {
    expect(selectionFromSku(shirt, "SKU-L-white")).toEqual({ size: "L", color: "white" });
    expect(selectionFromSku(shirt, "nope")).toBeUndefined();
    expect(selectionFromSku(shirt, undefined)).toBeUndefined();
  });
});
