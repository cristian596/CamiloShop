import { sortSizes } from "@/config/catalog";

export interface VariantOption {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  priceOverride: number | null;
  stock: number;
}

export interface VariantSelection {
  size: string | null;
  color: string | null;
}

/** Distinct sizes and colors in display order. */
export function getVariantAxes(variants: VariantOption[]) {
  const sizes = sortSizes([...new Set(variants.flatMap((v) => (v.size ? [v.size] : [])))]);
  const colors = [...new Set(variants.flatMap((v) => (v.color ? [v.color] : [])))];
  return { sizes, colors };
}

export function findVariant(
  variants: VariantOption[],
  selection: VariantSelection,
): VariantOption | undefined {
  return variants.find((v) => v.size === selection.size && v.color === selection.color);
}

/**
 * Whether picking `value` on one axis can still lead to an in-stock variant,
 * given what is already chosen on the other axis.
 */
export function isOptionAvailable(
  variants: VariantOption[],
  axis: "size" | "color",
  value: string,
  selection: VariantSelection,
): boolean {
  const other = axis === "size" ? "color" : "size";
  return variants.some(
    (v) =>
      v[axis] === value &&
      v.stock > 0 &&
      (selection[other] === null || v[other] === selection[other]),
  );
}

/** First in-stock variant (in display order), or the first one when all are sold out. */
export function getDefaultSelection(variants: VariantOption[]): VariantSelection {
  const { sizes, colors } = getVariantAxes(variants);
  const rank = (v: VariantOption) =>
    (v.size ? sizes.indexOf(v.size) : 0) * 1000 + (v.color ? colors.indexOf(v.color) : 0);
  const ordered = [...variants].sort((a, b) => rank(a) - rank(b));
  const chosen = ordered.find((v) => v.stock > 0) ?? ordered[0];
  return { size: chosen?.size ?? null, color: chosen?.color ?? null };
}

/** Selection from a `?variant=<sku>` param, when it matches a variant. */
export function selectionFromSku(
  variants: VariantOption[],
  sku: string | undefined,
): VariantSelection | undefined {
  const variant = sku ? variants.find((v) => v.sku === sku) : undefined;
  return variant ? { size: variant.size, color: variant.color } : undefined;
}

/** Changing one axis keeps the other when that combination exists; otherwise it falls back. */
export function applySelection(
  variants: VariantOption[],
  current: VariantSelection,
  axis: "size" | "color",
  value: string,
): VariantSelection {
  const next = { ...current, [axis]: value };
  if (findVariant(variants, next)) return next;

  const other = axis === "size" ? "color" : "size";
  const candidates = variants.filter((v) => v[axis] === value);
  const fallback = candidates.find((v) => v.stock > 0) ?? candidates[0];
  return { ...next, [other]: fallback?.[other] ?? null };
}

export const LOW_STOCK_THRESHOLD = 5;
