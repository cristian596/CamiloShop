"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { getAdminActor } from "./guard";
import { IMAGE_TYPES, MAX_IMAGES_PER_PRODUCT, MAX_IMAGE_BYTES, sniffImageType } from "./image-file";
import { adminFieldErrors, productSchema, slugify, type AdminFormState } from "./product-schema";
import { saveProduct } from "./product-service";

const BUCKET = "product-images";
const ADMIN_LAYOUT = "/[locale]/admin";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseVariants(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Create (no productId) or update a product with its variants. */
export async function saveProductAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };

  const productId = z.uuid().safeParse(formData.get("productId"));
  const nameEs = text(formData, "nameEs");
  const parsed = productSchema.safeParse({
    nameEs,
    nameEn: text(formData, "nameEn"),
    slug: text(formData, "slug").trim() || slugify(nameEs),
    descriptionEs: text(formData, "descriptionEs"),
    descriptionEn: text(formData, "descriptionEn"),
    categoryId: text(formData, "categoryId"),
    brandId: text(formData, "brandId"),
    price: text(formData, "price"),
    compareAtPrice: text(formData, "compareAtPrice"),
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    variants: parseVariants(text(formData, "variants")),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: adminFieldErrors(parsed.error) };
  }

  // Products live in subcategories (the storefront lists a root's children).
  const category = await getDb().category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { parentId: true },
  });
  if (!category?.parentId) {
    return { status: "error", fieldErrors: { categoryId: "invalid" } };
  }

  const result = await saveProduct(getDb(), productId.success ? productId.data : null, parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      error: result.field ? undefined : result.error,
      fieldErrors: result.field ? { [result.field]: result.error } : undefined,
    };
  }

  revalidatePath(ADMIN_LAYOUT, "layout");
  // Reload the edit page so the form gets the new variant ids (and, for a new
  // product, the image section, which needs a saved product).
  const locale = (await getLocale()) as Locale;
  const flag = productId.success ? "saved" : "created";
  return redirect({ href: `/admin/products/${result.productId}?${flag}=1`, locale });
}

/**
 * Deletes a product that was never ordered (with its variants and images).
 * Ordered products are only deactivated, so order history stays intact.
 */
export async function deleteProductAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };
  const parsed = z.uuid().safeParse(formData.get("productId"));
  if (!parsed.success) return { status: "error", error: "invalid" };

  const db = getDb();
  const orderLines = await db.orderItem.count({ where: { productId: parsed.data } });
  if (orderLines > 0) return { status: "error", error: "hasOrders" };

  const images = await db.productImage.findMany({
    where: { productId: parsed.data, storagePath: { not: null } },
    select: { storagePath: true },
  });
  const deleted = await db.product.deleteMany({ where: { id: parsed.data } });
  if (deleted.count === 0) return { status: "error", error: "notFound" };

  const paths = images.flatMap((image) => (image.storagePath ? [image.storagePath] : []));
  if (paths.length > 0) {
    const { error } = await createAdminClient().storage.from(BUCKET).remove(paths);
    if (error) console.error("[admin] could not remove product images", error.message);
  }

  revalidatePath(ADMIN_LAYOUT, "layout");
  const locale = (await getLocale()) as Locale;
  return redirect({ href: "/admin/products?deleted=1", locale });
}

const altField = z.string().trim().min(1, { error: "required" }).max(160, { error: "tooLong" });

/** Uploads one image to Supabase Storage and appends it to the gallery. */
export async function uploadProductImageAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };

  const productId = z.uuid().safeParse(formData.get("productId"));
  const altEs = altField.safeParse(text(formData, "altEs"));
  const altEn = altField.safeParse(text(formData, "altEn"));
  const file = formData.get("file");
  const fieldErrors: AdminFormState["fieldErrors"] = {};
  if (!altEs.success) fieldErrors.altEs = "required";
  if (!altEn.success) fieldErrors.altEn = "required";
  if (!(file instanceof File) || file.size === 0) fieldErrors.file = "required";
  else if (file.size > MAX_IMAGE_BYTES) fieldErrors.file = "fileSize";
  if (!productId.success) return { status: "error", error: "invalid" };
  if (
    Object.keys(fieldErrors).length > 0 ||
    !(file instanceof File) ||
    !altEs.success ||
    !altEn.success
  ) {
    return { status: "error", fieldErrors };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { status: "error", fieldErrors: { file: "fileType" } };

  const db = getDb();
  const [product, count, last] = await Promise.all([
    db.product.findUnique({ where: { id: productId.data }, select: { id: true } }),
    db.productImage.count({ where: { productId: productId.data } }),
    db.productImage.findFirst({
      where: { productId: productId.data },
      orderBy: { position: "desc" },
      select: { position: true },
    }),
  ]);
  if (!product) return { status: "error", error: "notFound" };
  if (count >= MAX_IMAGES_PER_PRODUCT) return { status: "error", error: "tooLong" };

  const path = `products/${productId.data}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("[admin] image upload failed", error.message);
    return { status: "error", error: "uploadFailed" };
  }

  await db.productImage.create({
    data: {
      productId: productId.data,
      url: `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      storagePath: path,
      altEs: altEs.data,
      altEn: altEn.data,
      position: (last?.position ?? -1) + 1,
    },
  });
  revalidatePath(ADMIN_LAYOUT, "layout");
  return { status: "success", savedAt: Date.now() };
}

const imageIdSchema = z.uuid();

/** Removes an image (and its file, when it lives in our bucket). */
export async function deleteProductImageAction(formData: FormData): Promise<void> {
  if (!(await getAdminActor())) return;
  const parsed = imageIdSchema.safeParse(formData.get("imageId"));
  if (!parsed.success) return;

  const db = getDb();
  const image = await db.productImage.findUnique({
    where: { id: parsed.data },
    select: { storagePath: true },
  });
  if (!image) return;
  await db.productImage.delete({ where: { id: parsed.data } });
  if (image.storagePath) {
    const { error } = await createAdminClient().storage.from(BUCKET).remove([image.storagePath]);
    if (error) console.error("[admin] could not remove image file", error.message);
  }
  revalidatePath(ADMIN_LAYOUT, "layout");
}

/** Swaps an image with its neighbour; the first image is the product's cover. */
export async function moveProductImageAction(formData: FormData): Promise<void> {
  if (!(await getAdminActor())) return;
  const parsed = z
    .object({ imageId: imageIdSchema, direction: z.enum(["up", "down"]) })
    .safeParse({ imageId: formData.get("imageId"), direction: formData.get("direction") });
  if (!parsed.success) return;

  const db = getDb();
  const image = await db.productImage.findUnique({
    where: { id: parsed.data.imageId },
    select: { productId: true },
  });
  if (!image) return;

  const images = await db.productImage.findMany({
    where: { productId: image.productId },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const index = images.findIndex((row) => row.id === parsed.data.imageId);
  const target = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= images.length) return;

  // Rewrite every position as 0..n-1 so earlier gaps or ties disappear too.
  const order = images.map((row) => row.id);
  [order[index], order[target]] = [order[target]!, order[index]!];
  await db.$transaction(
    order.map((id, position) => db.productImage.update({ where: { id }, data: { position } })),
  );
  revalidatePath(ADMIN_LAYOUT, "layout");
}
