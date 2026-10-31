import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  getPaginationItems,
  parseListingParams,
  toQueryString,
  totalPages,
} from "@/features/catalog/listing-params";

describe("parseListingParams", () => {
  it("returns defaults for empty params", () => {
    expect(parseListingParams({})).toEqual({
      sizes: [],
      colors: [],
      brands: [],
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      sort: "featured",
      page: 1,
    });
  });

  it("reads repeated and single values", () => {
    const filters = parseListingParams({
      brand: ["kairo", "nova-audio"],
      size: "M",
      color: ["black", "white"],
      min: "100000",
      max: "500000",
      rating: "4",
      sort: "price-asc",
      page: "3",
    });
    expect(filters).toMatchObject({
      brands: ["kairo", "nova-audio"],
      sizes: ["M"],
      colors: ["black", "white"],
      minPrice: 100_000,
      maxPrice: 500_000,
      minRating: 4,
      sort: "price-asc",
      page: 3,
    });
  });

  it("keeps sizes with spaces such as 128 GB or 50 ml", () => {
    expect(parseListingParams({ size: ["128 GB", "50 ml"] }).sizes).toEqual(["128 GB", "50 ml"]);
  });

  it("drops invalid values instead of throwing", () => {
    const filters = parseListingParams({
      brand: ["Kairo!", "../etc", "valid-brand"],
      color: ["black", "not-a-color"],
      size: ["<script>", "M"],
      min: "-5",
      max: "abc",
      rating: "9",
      sort: "random",
      page: "0",
    });
    expect(filters).toMatchObject({
      brands: ["valid-brand"],
      colors: ["black"],
      sizes: ["M"],
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      sort: "featured",
      page: 1,
    });
  });

  it("swaps an inverted price range", () => {
    const filters = parseListingParams({ min: "500000", max: "100000" });
    expect(filters.minPrice).toBe(100_000);
    expect(filters.maxPrice).toBe(500_000);
  });

  it("deduplicates and caps repeated values", () => {
    const many = Array.from({ length: 50 }, (_, index) => `brand-${index}`);
    expect(parseListingParams({ brand: [...many, "brand-0"] }).brands).toHaveLength(20);
    expect(parseListingParams({ color: ["black", "black"] }).colors).toEqual(["black"]);
  });

  it("rejects absurd page numbers", () => {
    expect(parseListingParams({ page: "99999" }).page).toBe(1);
  });
});

describe("toQueryString", () => {
  it("omits defaults", () => {
    expect(toQueryString(parseListingParams({}))).toBe("");
  });

  it("round-trips through the parser", () => {
    const original = parseListingParams({
      brand: "kairo",
      size: ["128 GB"],
      color: "blue",
      min: "1000",
      rating: "3",
      sort: "newest",
      page: "2",
    });
    const query = toQueryString(original);
    const reparsed = parseListingParams(
      Object.fromEntries(
        [...new URLSearchParams(query).keys()].map((key) => [
          key,
          new URLSearchParams(query).getAll(key),
        ]),
      ),
    );
    expect(reparsed).toEqual(original);
  });

  it("applies overrides, e.g. resetting the page when a filter is removed", () => {
    const filters = parseListingParams({ brand: ["kairo", "selva"], page: "4" });
    expect(toQueryString(filters, { brands: ["selva"], page: 1 })).toBe("?brand=selva");
  });
});

describe("countActiveFilters", () => {
  it("counts the price range and rating once each", () => {
    const filters = parseListingParams({ brand: ["a", "b"], min: "1", max: "2", rating: "4" });
    expect(countActiveFilters(filters)).toBe(4);
  });
});

describe("getPaginationItems", () => {
  it("handles empty and single-page results", () => {
    expect(getPaginationItems(1, 0)).toEqual([]);
    expect(getPaginationItems(1, 1)).toEqual([1]);
  });

  it("lists every page when there are few", () => {
    expect(getPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds ellipses around the current window", () => {
    expect(getPaginationItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("does not hide a single page behind an ellipsis", () => {
    expect(getPaginationItems(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    expect(getPaginationItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPaginationItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });

  it("clamps out-of-range pages", () => {
    expect(getPaginationItems(50, 3)).toEqual([1, 2, 3]);
  });
});

describe("totalPages", () => {
  it("never returns less than one page", () => {
    expect(totalPages(0, 12)).toBe(1);
    expect(totalPages(12, 12)).toBe(1);
    expect(totalPages(13, 12)).toBe(2);
  });
});
