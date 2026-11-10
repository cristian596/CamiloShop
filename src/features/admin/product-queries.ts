import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ADMIN_PAGE_SIZE } from "./order-queries";

export const productFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  state: z.enum(["active", "inactive", "lowStock"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

export const LOW_STOCK = 3;

export async function listAdminProducts(filters: ProductFilters) {
  const where: Prisma.ProductWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { nameEs: { contains: filters.q, mode: "insensitive" } },
            { nameEn: { contains: filters.q, mode: "insensitive" } },
            { slug: { contains: filters.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(filters.category ? { categoryId: filters.category } : {}),
    ...(filters.state === "active" ? { isActive: true } : {}),
    ...(filters.state === "inactive" ? { isActive: false } : {}),
    ...(filters.state === "lowStock" ? { variants: { some: { stock: { lte: LOW_STOCK } } } } : {}),
  };
  const db = getDb();
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        nameEs: true,
        nameEn: true,
        price: true,
        isActive: true,
        isFeatured: true,
        soldCount: true,
        category: { select: { nameEs: true, nameEn: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: { select: { stock: true } },
      },
    }),
  ]);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    products: products.map(({ variants, images, ...product }) => ({
      ...product,
      image: images[0]?.url ?? null,
      stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
      lowStock: variants.some((variant) => variant.stock <= LOW_STOCK),
    })),
  };
}

/** Subcategories grouped by root, and brands: the options of the product form. */
export async function getProductFormOptions() {
  const db = getDb();
  const [roots, brands] = await Promise.all([
    db.category.findMany({
      where: { parentId: null },
      orderBy: { position: "asc" },
      select: {
        id: true,
        nameEs: true,
        nameEn: true,
        children: {
          orderBy: { position: "asc" },
          select: { id: true, nameEs: true, nameEn: true },
        },
      },
    }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { roots, brands };
}

export type ProductFormOptions = Awaited<ReturnType<typeof getProductFormOptions>>;

export async function getAdminProduct(id: string) {
  return getDb().product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      nameEs: true,
      nameEn: true,
      descriptionEs: true,
      descriptionEn: true,
      categoryId: true,
      brandId: true,
      price: true,
      compareAtPrice: true,
      isActive: true,
      isFeatured: true,
      soldCount: true,
      updatedAt: true,
      variants: {
        orderBy: [{ size: "asc" }, { color: "asc" }],
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          priceOverride: true,
          stock: true,
          _count: { select: { orderItems: true } },
        },
      },
      images: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, url: true, altEs: true, altEn: true, storagePath: true },
      },
      _count: { select: { favorites: true } },
    },
  });
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;
