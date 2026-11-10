import { Prisma, type PrismaClient } from "@prisma/client";
import { COLORS } from "@/config/catalog";
import type { AdminErrorKey, ProductInput } from "./product-schema";

export type SaveProductResult =
  { ok: true; productId: string } | { ok: false; error: AdminErrorKey; field?: string };

class SaveError extends Error {
  constructor(
    readonly key: AdminErrorKey,
    readonly field?: string,
  ) {
    super(key);
  }
}

/**
 * Creates or updates a product and reconciles its variants in one transaction:
 * rows with an id are updated (only if they belong to this product), rows
 * without one are created, and missing rows are deleted unless an order still
 * references them (order history must keep pointing at the real variant).
 */
export async function saveProduct(
  db: PrismaClient,
  productId: string | null,
  input: ProductInput,
): Promise<SaveProductResult> {
  const { variants, ...fields } = input;
  try {
    const id = await db.$transaction(async (tx) => {
      const product = productId
        ? await tx.product.update({ where: { id: productId }, data: fields, select: { id: true } })
        : await tx.product.create({ data: fields, select: { id: true } });

      const existing = await tx.productVariant.findMany({
        where: { productId: product.id },
        select: { id: true, _count: { select: { orderItems: true } } },
      });
      const existingIds = new Set(existing.map((variant) => variant.id));
      const keptIds = new Set(variants.flatMap((variant) => (variant.id ? [variant.id] : [])));

      for (const variant of existing) {
        if (keptIds.has(variant.id)) continue;
        if (variant._count.orderItems > 0) throw new SaveError("variantInUse", "variants");
        await tx.productVariant.delete({ where: { id: variant.id } });
      }

      for (const [index, variant] of variants.entries()) {
        const data = {
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          colorHex: variant.color ? COLORS[variant.color] : null,
          priceOverride: variant.priceOverride,
          stock: variant.stock,
        };
        if (variant.id) {
          if (!existingIds.has(variant.id)) throw new SaveError("invalid", `variants.${index}.sku`);
          await tx.productVariant.update({ where: { id: variant.id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId: product.id } });
        }
      }
      return product.id;
    });
    return { ok: true, productId: id };
  } catch (error) {
    if (error instanceof SaveError) return { ok: false, error: error.key, field: error.field };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return { ok: false, error: "notFound" };
      if (error.code === "P2002") {
        const target = JSON.stringify(error.meta ?? {});
        if (target.includes("sku")) return { ok: false, error: "skuTaken", field: "variants" };
        if (target.includes("slug")) return { ok: false, error: "slugTaken", field: "slug" };
      }
      if (error.code === "P2003") return { ok: false, error: "invalid", field: "categoryId" };
    }
    console.error("[admin] save product failed", error);
    return { ok: false, error: "generic" };
  }
}
