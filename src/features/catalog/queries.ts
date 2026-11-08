import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { PAGE_SIZE, isColorKey, sortSizes, type ColorKey } from "@/config/catalog";
import { getDb } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { DEFAULT_FREE_SHIPPING_THRESHOLD, DEFAULT_TAX_RATE } from "@/features/checkout/pricing";
import type { ListingFilters, SortOption } from "./listing-params";
import { escapeLikePattern } from "./search-query";
import type { VariantOption } from "./variants";

const productSummarySelect = {
  id: true,
  slug: true,
  nameEs: true,
  nameEn: true,
  price: true,
  compareAtPrice: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  brand: { select: { name: true } },
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, altEs: true, altEn: true },
  },
  variants: { where: { stock: { gt: 0 } }, take: 1, select: { id: true } },
} satisfies Prisma.ProductSelect;

type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof productSummarySelect }>;

export interface ProductSummary {
  id: string;
  slug: string;
  name: { es: string; en: string };
  brand: string;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  image: { url: string; alt: { es: string; en: string } } | null;
  inStock: boolean;
}

function toSummary(row: ProductSummaryRow): ProductSummary {
  const image = row.images[0];
  return {
    id: row.id,
    slug: row.slug,
    name: { es: row.nameEs, en: row.nameEn },
    brand: row.brand.name,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    createdAt: row.createdAt,
    image: image ? { url: image.url, alt: { es: image.altEs, en: image.altEn } } : null,
    inStock: row.variants.length > 0,
  };
}

const ORDER_BY: Record<SortOption, Prisma.ProductOrderByWithRelationInput[]> = {
  featured: [{ isFeatured: "desc" }, { soldCount: "desc" }, { id: "asc" }],
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  "price-asc": [{ price: "asc" }, { id: "asc" }],
  "price-desc": [{ price: "desc" }, { id: "asc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
  "best-selling": [{ soldCount: "desc" }, { id: "asc" }],
};

/** Prisma filter for a listing; exported for unit tests. */
export function buildProductWhere(
  categoryIds: string[],
  filters: ListingFilters,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true, categoryId: { in: categoryIds } };

  if (filters.brands.length > 0) where.brand = { slug: { in: filters.brands } };
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = { gte: filters.minPrice, lte: filters.maxPrice };
  }
  if (filters.minRating !== undefined) where.ratingAvg = { gte: filters.minRating };
  if (filters.sizes.length > 0 || filters.colors.length > 0) {
    // Size and color must match on the same variant (e.g. "M" in "black").
    where.variants = {
      some: {
        ...(filters.sizes.length > 0 && { size: { in: filters.sizes } }),
        ...(filters.colors.length > 0 && { color: { in: filters.colors } }),
      },
    };
  }

  return where;
}

/** Display-only COP→USD rate from the Setting table, with an env fallback. */
export interface StoreSettings {
  /** Display-only COP -> USD rate. */
  usdRate: number;
  freeShippingThreshold: number;
  taxRate: number;
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** Store-wide settings from the Setting table, with safe defaults. */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const defaults: StoreSettings = {
    usdRate: publicEnv.NEXT_PUBLIC_DEFAULT_USD_RATE,
    freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
    taxRate: DEFAULT_TAX_RATE,
  };
  try {
    const rows = await getDb().setting.findMany({
      where: { key: { in: ["usdRate", "freeShippingThreshold", "taxRate"] } },
    });
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    return {
      usdRate: positiveNumber(value("usdRate"), defaults.usdRate),
      freeShippingThreshold: positiveNumber(
        value("freeShippingThreshold"),
        defaults.freeShippingThreshold,
      ),
      taxRate: positiveNumber(value("taxRate"), defaults.taxRate),
    };
  } catch (error) {
    // Rendering pages must not depend on this read; checkout re-reads it in its transaction.
    console.error("[catalog] could not read settings", error);
    return defaults;
  }
});

export async function getFeaturedProducts(limit = 8): Promise<ProductSummary[]> {
  const rows = await getDb().product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: ORDER_BY["best-selling"],
    take: limit,
    select: productSummarySelect,
  });
  return rows.map(toSummary);
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: { es: string; en: string };
}

export interface CategoryContext {
  root: CategoryNode & { children: CategoryNode[] };
  child: CategoryNode | null;
  /** Category ids whose products belong to this listing. */
  categoryIds: string[];
}

/** Resolves /c/<root>[/<child>]; returns null for unknown or mismatched slugs. */
export const getCategoryContext = cache(
  async (slugs: string[]): Promise<CategoryContext | null> => {
    const [rootSlug, childSlug, ...rest] = slugs;
    if (!rootSlug || rest.length > 0) return null;

    const root = await getDb().category.findFirst({
      where: { slug: rootSlug, parentId: null },
      select: {
        id: true,
        slug: true,
        nameEs: true,
        nameEn: true,
        children: {
          orderBy: { position: "asc" },
          select: { id: true, slug: true, nameEs: true, nameEn: true },
        },
      },
    });
    if (!root) return null;

    const toNode = (row: {
      id: string;
      slug: string;
      nameEs: string;
      nameEn: string;
    }): CategoryNode => ({
      id: row.id,
      slug: row.slug,
      name: { es: row.nameEs, en: row.nameEn },
    });
    const children = root.children.map(toNode);
    const child = childSlug ? (children.find((node) => node.slug === childSlug) ?? null) : null;
    if (childSlug && !child) return null;

    return {
      root: { ...toNode(root), children },
      child,
      categoryIds: child ? [child.id] : [root.id, ...children.map((node) => node.id)],
    };
  },
);

export async function getListing(categoryIds: string[], filters: ListingFilters) {
  const db = getDb();
  const where = buildProductWhere(categoryIds, filters);

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: ORDER_BY[filters.sort],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productSummarySelect,
    }),
  ]);

  return { total, items: rows.map(toSummary) };
}

export interface Facets {
  brands: { slug: string; name: string }[];
  sizes: string[];
  colors: ColorKey[];
}

/** Filter options that actually exist within the given categories. */
export async function getFacets(categoryIds: string[]): Promise<Facets> {
  const db = getDb();
  const productWhere: Prisma.ProductWhereInput = {
    isActive: true,
    categoryId: { in: categoryIds },
  };

  const [brands, sizeRows, colorRows] = await Promise.all([
    db.brand.findMany({
      where: { products: { some: productWhere } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    db.productVariant.findMany({
      where: { product: productWhere, size: { not: null } },
      distinct: ["size"],
      select: { size: true },
    }),
    db.productVariant.findMany({
      where: { product: productWhere, color: { not: null } },
      distinct: ["color"],
      select: { color: true },
    }),
  ]);

  return {
    brands,
    sizes: sortSizes(sizeRows.flatMap((row) => (row.size ? [row.size] : []))),
    colors: colorRows.flatMap((row) => (row.color && isColorKey(row.color) ? [row.color] : [])),
  };
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export interface ProductDetail {
  id: string;
  slug: string;
  name: { es: string; en: string };
  description: { es: string; en: string };
  brand: { slug: string; name: string };
  category: CategoryNode;
  rootCategory: CategoryNode | null;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  categoryId: string;
  brandId: string;
  images: { id: string; url: string; alt: { es: string; en: string } }[];
  variants: VariantOption[];
}

export const getProductDetail = cache(async (slug: string): Promise<ProductDetail | null> => {
  const row = await getDb().product.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      nameEs: true,
      nameEn: true,
      descriptionEs: true,
      descriptionEn: true,
      price: true,
      compareAtPrice: true,
      ratingAvg: true,
      ratingCount: true,
      createdAt: true,
      categoryId: true,
      brandId: true,
      brand: { select: { slug: true, name: true } },
      category: {
        select: {
          id: true,
          slug: true,
          nameEs: true,
          nameEn: true,
          parent: { select: { id: true, slug: true, nameEs: true, nameEn: true } },
        },
      },
      images: {
        orderBy: { position: "asc" },
        select: { id: true, url: true, altEs: true, altEn: true },
      },
      variants: {
        orderBy: { sku: "asc" },
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          colorHex: true,
          priceOverride: true,
          stock: true,
        },
      },
    },
  });
  if (!row) return null;

  const node = (c: { id: string; slug: string; nameEs: string; nameEn: string }) => ({
    id: c.id,
    slug: c.slug,
    name: { es: c.nameEs, en: c.nameEn },
  });

  return {
    id: row.id,
    slug: row.slug,
    name: { es: row.nameEs, en: row.nameEn },
    description: { es: row.descriptionEs, en: row.descriptionEn },
    brand: row.brand,
    category: node(row.category),
    rootCategory: row.category.parent ? node(row.category.parent) : null,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    brandId: row.brandId,
    images: row.images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: { es: image.altEs, en: image.altEn },
    })),
    variants: row.variants,
  };
});

/**
 * Related products, in priority order: same subcategory, same brand, then the rest of
 * the parent category. Best sellers first within each group.
 */
export async function getRelatedProducts(
  product: Pick<ProductDetail, "id" | "categoryId" | "brandId" | "rootCategory">,
  limit = 4,
): Promise<ProductSummary[]> {
  const rows = await getDb().product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [
        { categoryId: product.categoryId },
        { brandId: product.brandId },
        ...(product.rootCategory ? [{ category: { parentId: product.rootCategory.id } }] : []),
      ],
    },
    orderBy: ORDER_BY["best-selling"],
    take: limit * 4,
    select: { ...productSummarySelect, categoryId: true, brandId: true },
  });

  const priority = (row: (typeof rows)[number]) =>
    row.categoryId === product.categoryId ? 2 : row.brandId === product.brandId ? 1 : 0;

  // Array.prototype.sort is stable, so best-selling order is kept within each group.
  return rows
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, limit)
    .map(toSummary);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Every word must appear (accent- and case-insensitive) in the product name (es/en),
 * the brand or the category name. The LIKE expressions match the trigram indexes
 * created in the init migration.
 */
function searchConditions(query: string): Prisma.Sql {
  const terms = query.split(" ").filter(Boolean).slice(0, 6);
  const conditions = terms.map((term) => {
    const escaped = escapeLikePattern(term);
    return Prisma.sql`(
      public.immutable_unaccent(lower(p."nameEs")) LIKE '%' || public.immutable_unaccent(lower(${escaped})) || '%'
      OR public.immutable_unaccent(lower(p."nameEn")) LIKE '%' || public.immutable_unaccent(lower(${escaped})) || '%'
      OR public.immutable_unaccent(lower(b.name)) LIKE '%' || public.immutable_unaccent(lower(${escaped})) || '%'
      OR public.immutable_unaccent(lower(c."nameEs")) LIKE '%' || public.immutable_unaccent(lower(${escaped})) || '%'
      OR public.immutable_unaccent(lower(c."nameEn")) LIKE '%' || public.immutable_unaccent(lower(${escaped})) || '%'
    )`;
  });
  return Prisma.sql`p."isActive" AND ${Prisma.join(conditions, " AND ")}`;
}

async function searchProductIds(query: string, limit: number, offset: number): Promise<string[]> {
  const rows = await getDb().$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Product" p
    JOIN "Brand" b ON b.id = p."brandId"
    JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${searchConditions(query)}
    ORDER BY greatest(
      extensions.word_similarity(public.immutable_unaccent(lower(${query})), public.immutable_unaccent(lower(p."nameEs"))),
      extensions.word_similarity(public.immutable_unaccent(lower(${query})), public.immutable_unaccent(lower(p."nameEn")))
    ) DESC, p."soldCount" DESC, p.id
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((row) => row.id);
}

async function getSummariesInOrder(ids: string[]): Promise<ProductSummary[]> {
  if (ids.length === 0) return [];
  const rows = await getDb().product.findMany({
    where: { id: { in: ids } },
    select: productSummarySelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toSummary(row)] : [];
  });
}

export async function searchProducts(query: string, page: number) {
  const [countRows, ids] = await Promise.all([
    getDb().$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM "Product" p
      JOIN "Brand" b ON b.id = p."brandId"
    JOIN "Category" c ON c.id = p."categoryId"
      WHERE ${searchConditions(query)}
    `,
    searchProductIds(query, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);

  return { total: countRows[0]?.total ?? 0, items: await getSummariesInOrder(ids) };
}

export async function suggestProducts(query: string, limit = 6): Promise<ProductSummary[]> {
  return getSummariesInOrder(await searchProductIds(query, limit, 0));
}

/** The user's favorite products that are still active, newest first. */
export async function getFavoriteProducts(userId: string): Promise<ProductSummary[]> {
  const favorites = await getDb().favorite.findMany({
    where: { userId, product: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: { product: { select: productSummarySelect } },
  });
  return favorites.map((favorite) => toSummary(favorite.product));
}

export async function isFavoriteProduct(userId: string, productId: string): Promise<boolean> {
  const count = await getDb().favorite.count({ where: { userId, productId } });
  return count > 0;
}
