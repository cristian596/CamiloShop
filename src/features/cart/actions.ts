"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { MAX_CART_LINES } from "@/features/checkout/pricing";
import type { CartSnapshotLine } from "@/stores/cart";

const variantIdsSchema = z.array(z.uuid()).max(MAX_CART_LINES);

/**
 * Current price and stock for the variants in a browser cart. Read-only and
 * public (guests can browse with a cart); unknown or inactive items come back
 * as unavailable.
 */
export async function getCartSnapshotAction(variantIds: string[]): Promise<CartSnapshotLine[]> {
  const parsed = variantIdsSchema.safeParse(variantIds);
  if (!parsed.success || parsed.data.length === 0) return [];

  const variants = await getDb().productVariant.findMany({
    where: { id: { in: parsed.data } },
    select: {
      id: true,
      stock: true,
      priceOverride: true,
      product: { select: { price: true, isActive: true } },
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  return parsed.data.map((variantId) => {
    const variant = byId.get(variantId);
    return {
      variantId,
      available: Boolean(variant?.product.isActive),
      unitPrice: variant ? (variant.priceOverride ?? variant.product.price) : 0,
      stock: variant?.stock ?? 0,
    };
  });
}
