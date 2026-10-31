import { describe, expect, it } from "vitest";
import { escapeLikePattern, normalizeSearchQuery } from "@/features/catalog/search-query";
import { addRecentlyViewed, type RecentlyViewedItem } from "@/stores/recently-viewed";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  audífonos   inalámbricos ")).toBe("audífonos inalámbricos");
  });

  it("rejects too-short or missing queries", () => {
    expect(normalizeSearchQuery("a")).toBeNull();
    expect(normalizeSearchQuery("   ")).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
    expect(normalizeSearchQuery(null)).toBeNull();
  });

  it("uses the first value of repeated params and caps the length", () => {
    expect(normalizeSearchQuery(["tenis", "botas"])).toBe("tenis");
    expect(normalizeSearchQuery("x".repeat(200))).toHaveLength(80);
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLikePattern("100%_off\\")).toBe("100\\%\\_off\\\\");
    expect(escapeLikePattern("camiseta")).toBe("camiseta");
  });
});

function item(slug: string): RecentlyViewedItem {
  return {
    slug,
    name: { es: slug, en: slug },
    brand: "Brand",
    price: 1000,
    compareAtPrice: null,
    image: null,
  };
}

describe("addRecentlyViewed", () => {
  it("puts the latest product first", () => {
    const list = addRecentlyViewed([item("a"), item("b")], item("c"));
    expect(list.map((entry) => entry.slug)).toEqual(["c", "a", "b"]);
  });

  it("moves an already viewed product to the front instead of duplicating it", () => {
    const list = addRecentlyViewed([item("a"), item("b"), item("c")], item("b"));
    expect(list.map((entry) => entry.slug)).toEqual(["b", "a", "c"]);
  });

  it("keeps at most the limit", () => {
    const list = addRecentlyViewed([item("a"), item("b"), item("c")], item("d"), 3);
    expect(list.map((entry) => entry.slug)).toEqual(["d", "a", "b"]);
  });
});
