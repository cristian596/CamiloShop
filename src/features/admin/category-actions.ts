"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAdminActor } from "./guard";
import { adminFieldErrors, slugField, slugify, type AdminFormState } from "./product-schema";

const nameField = z.string().trim().min(1, { error: "required" }).max(60, { error: "tooLong" });

const categorySchema = z.object({
  nameEs: nameField,
  nameEn: nameField,
  slug: slugField,
  position: z.coerce
    .number()
    .int({ error: "invalid" })
    .min(0, { error: "invalid" })
    .max(999, { error: "invalid" }),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readCategory(formData: FormData) {
  const nameEs = text(formData, "nameEs");
  return categorySchema.safeParse({
    nameEs,
    nameEn: text(formData, "nameEn"),
    slug: text(formData, "slug").trim() || slugify(nameEs),
    position: text(formData, "position") || "0",
  });
}

function saveError(error: unknown): AdminFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { status: "error", fieldErrors: { slug: "slugTaken" } };
  }
  console.error("[admin] save category failed", error);
  return { status: "error", error: "generic" };
}

/**
 * Updates a category. Root slugs are fixed: the header, footer and home link to
 * them from src/config/categories.ts, so renaming them would break navigation.
 */
export async function updateCategoryAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };
  const id = z.uuid().safeParse(formData.get("categoryId"));
  if (!id.success) return { status: "error", error: "invalid" };

  const db = getDb();
  const current = await db.category.findUnique({
    where: { id: id.data },
    select: { parentId: true, slug: true },
  });
  if (!current) return { status: "error", error: "notFound" };

  if (current.parentId === null) formData.set("slug", current.slug);
  const parsed = readCategory(formData);
  if (!parsed.success) return { status: "error", fieldErrors: adminFieldErrors(parsed.error) };

  try {
    await db.category.update({ where: { id: id.data }, data: parsed.data });
  } catch (error) {
    return saveError(error);
  }
  revalidatePath("/[locale]", "layout");
  return { status: "success", savedAt: Date.now() };
}

/** New subcategory under an existing root (the tree has two levels). */
export async function createCategoryAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };
  const parentId = z.uuid().safeParse(formData.get("parentId"));
  if (!parentId.success) return { status: "error", error: "invalid" };

  const db = getDb();
  const parent = await db.category.findUnique({
    where: { id: parentId.data },
    select: { parentId: true },
  });
  if (!parent || parent.parentId !== null) return { status: "error", error: "invalid" };

  const parsed = readCategory(formData);
  if (!parsed.success) return { status: "error", fieldErrors: adminFieldErrors(parsed.error) };

  try {
    await db.category.create({ data: { ...parsed.data, parentId: parentId.data } });
  } catch (error) {
    return saveError(error);
  }
  revalidatePath("/[locale]", "layout");
  return { status: "success", savedAt: Date.now() };
}

/** Deletes an empty subcategory (roots and categories with products stay). */
export async function deleteCategoryAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (!(await getAdminActor())) return { status: "error", error: "forbidden" };
  const id = z.uuid().safeParse(formData.get("categoryId"));
  if (!id.success) return { status: "error", error: "invalid" };

  const db = getDb();
  const category = await db.category.findUnique({
    where: { id: id.data },
    select: { parentId: true, _count: { select: { products: true, children: true } } },
  });
  if (!category) return { status: "error", error: "notFound" };
  if (category.parentId === null || category._count.children > 0) {
    return { status: "error", error: "hasChildren" };
  }
  if (category._count.products > 0) return { status: "error", error: "hasProducts" };

  await db.category.delete({ where: { id: id.data } });
  revalidatePath("/[locale]", "layout");
  return { status: "success", savedAt: Date.now() };
}
