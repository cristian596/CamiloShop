import { describe, expect, it, vi } from "vitest";

// queries.ts is server-only and imports the Cloudflare/Prisma runtime; only the
// pure where-builder is under test here.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const { buildProductWhere } = await import("@/features/catalog/queries");
const { parseListingParams } = await import("@/features/catalog/listing-params");

describe("buildProductWhere", () => {
  it("always limits to active products in the given categories", () => {
    expect(buildProductWhere(["c1", "c2"], parseListingParams({}))).toEqual({
      isActive: true,
      categoryId: { in: ["c1", "c2"] },
    });
  });

  it("maps brand, price and rating filters", () => {
    const where = buildProductWhere(
      ["c1"],
      parseListingParams({ brand: "kairo", min: "100", max: "900", rating: "4" }),
    );
    expect(where).toMatchObject({
      brand: { slug: { in: ["kairo"] } },
      price: { gte: 100, lte: 900 },
      ratingAvg: { gte: 4 },
    });
  });

  it("supports an open-ended price range", () => {
    const where = buildProductWhere(["c1"], parseListingParams({ min: "500" }));
    expect(where.price).toEqual({ gte: 500, lte: undefined });
  });

  it("requires size and color on the same variant", () => {
    const where = buildProductWhere(["c1"], parseListingParams({ size: "M", color: "black" }));
    expect(where.variants).toEqual({ some: { size: { in: ["M"] }, color: { in: ["black"] } } });
  });

  it("filters by color alone without constraining size", () => {
    const where = buildProductWhere(["c1"], parseListingParams({ color: "red" }));
    expect(where.variants).toEqual({ some: { color: { in: ["red"] } } });
  });
});
