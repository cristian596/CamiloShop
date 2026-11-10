import { z } from "zod";
import { COLORS, type ColorKey } from "@/config/catalog";

/** Translation keys under "Admin.errors". */
export type AdminErrorKey =
  | "required"
  | "tooLong"
  | "invalid"
  | "slugInvalid"
  | "slugTaken"
  | "skuTaken"
  | "skuDuplicate"
  | "duplicateVariant"
  | "priceInvalid"
  | "compareAtInvalid"
  | "variantsRequired"
  | "variantInUse"
  | "hasOrders"
  | "hasProducts"
  | "hasChildren"
  | "codeTaken"
  | "valueInvalid"
  | "datesInvalid"
  | "fileType"
  | "fileSize"
  | "uploadFailed"
  | "self"
  | "forbidden"
  | "notFound"
  | "generic";

export const MAX_VARIANTS = 30;
export const MAX_PRICE = 50_000_000;

/** "Audífonos Pro X" -> "audifonos-pro-x" (accents removed, URL-safe). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const required = (max: number) =>
  z.string().trim().min(1, { error: "required" }).max(max, { error: "tooLong" });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((value) => (value === "" ? null : value));

/** Whole pesos; empty means "not set". */
const optionalPrice = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? null : value))
  .pipe(
    z
      .number()
      .int({ error: "priceInvalid" })
      .min(1, { error: "priceInvalid" })
      .max(MAX_PRICE, { error: "priceInvalid" })
      .nullable(),
  );

export const slugField = z
  .string()
  .trim()
  .max(80, { error: "tooLong" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "slugInvalid" });

export const variantSchema = z.object({
  id: z.uuid().optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, { error: "required" })
    .max(40, { error: "tooLong" })
    .regex(/^[A-Z0-9-]+$/, { error: "invalid" }),
  size: optionalText(20),
  color: z
    .union([z.literal(""), z.enum(Object.keys(COLORS) as [ColorKey, ...ColorKey[]])])
    .transform((value) => (value === "" ? null : value)),
  priceOverride: optionalPrice,
  stock: z.coerce
    .number()
    .int({ error: "invalid" })
    .min(0, { error: "invalid" })
    .max(100_000, { error: "invalid" }),
});

export type VariantInput = z.infer<typeof variantSchema>;

export const productSchema = z
  .object({
    nameEs: required(120),
    nameEn: required(120),
    slug: slugField,
    descriptionEs: required(4000),
    descriptionEn: required(4000),
    categoryId: z.uuid({ error: "required" }),
    brandId: z.uuid({ error: "required" }),
    price: z.coerce
      .number({ error: "priceInvalid" })
      .int({ error: "priceInvalid" })
      .min(1, { error: "priceInvalid" })
      .max(MAX_PRICE, { error: "priceInvalid" }),
    compareAtPrice: optionalPrice,
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    variants: z
      .array(variantSchema)
      .min(1, { error: "variantsRequired" })
      .max(MAX_VARIANTS, { error: "tooLong" }),
  })
  .superRefine((product, ctx) => {
    if (product.compareAtPrice !== null && product.compareAtPrice <= product.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "compareAtInvalid" });
    }
    const skus = new Set<string>();
    const combos = new Set<string>();
    product.variants.forEach((variant, index) => {
      if (skus.has(variant.sku)) {
        ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "skuDuplicate" });
      }
      skus.add(variant.sku);
      const combo = `${variant.size ?? ""}|${variant.color ?? ""}`;
      if (combos.has(combo)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "size"],
          message: "duplicateVariant",
        });
      }
      combos.add(combo);
    });
  });

export type ProductInput = z.infer<typeof productSchema>;

const KNOWN_ERRORS = new Set<string>([
  "required",
  "tooLong",
  "invalid",
  "slugInvalid",
  "priceInvalid",
  "compareAtInvalid",
  "variantsRequired",
  "skuDuplicate",
  "duplicateVariant",
  "codeTaken",
  "valueInvalid",
  "datesInvalid",
]);

/** Zod issues -> { "nameEs": "required", "variants.2.sku": "skuDuplicate" }. */
export function adminFieldErrors(error: z.ZodError): Record<string, AdminErrorKey> {
  const result: Record<string, AdminErrorKey> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    if (result[field]) continue;
    result[field] = (KNOWN_ERRORS.has(issue.message) ? issue.message : "invalid") as AdminErrorKey;
  }
  return result;
}

export interface AdminFormState {
  status: "idle" | "error" | "success";
  error?: AdminErrorKey;
  fieldErrors?: Record<string, AdminErrorKey>;
  savedAt?: number;
}
