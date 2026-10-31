import { describe, expect, it } from "vitest";
import { COLORS, COLOR_SWATCH_CLASSES, sortSizes } from "@/config/catalog";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

describe("color config", () => {
  it("keeps swatch classes in sync with the hex values", () => {
    for (const [key, hex] of Object.entries(COLORS)) {
      expect(COLOR_SWATCH_CLASSES[key as keyof typeof COLORS]).toBe(`bg-[${hex}]`);
    }
  });

  it("has a translated name for every color", () => {
    for (const key of Object.keys(COLORS)) {
      expect(es.Colors).toHaveProperty(key);
      expect(en.Colors).toHaveProperty(key);
    }
  });
});

describe("sortSizes", () => {
  it("orders known sizes and appends unknown ones alphabetically", () => {
    expect(sortSizes(["XL", "Talla única", "S", "42", "M", "128 GB", "Ajustable"])).toEqual([
      "S",
      "M",
      "XL",
      "42",
      "128 GB",
      "Ajustable",
      "Talla única",
    ]);
  });
});
