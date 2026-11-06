"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_ADDRESSES } from "@/config/colombia";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accountFieldErrors, addressSchema, profileSchema, type AccountErrorKey } from "./schemas";

export interface AccountFormState {
  status: "idle" | "error" | "success";
  error?: AccountErrorKey;
  fieldErrors?: Record<string, AccountErrorKey>;
  /** Changes on every successful save, so client forms can reset/close. */
  savedAt?: number;
}

const ADDRESSES_PATH = "/[locale]/account/addresses";

function formValues(formData: FormData, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : ""];
    }),
  );
}

/** Every action re-checks the session; the middleware is only a UX redirect. */
async function sessionUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export async function updateProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await sessionUserId();
  if (!userId) return { status: "error", error: "generic" };

  const values = formValues(formData, ["fullName", "phone", "locale"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: accountFieldErrors(parsed.error) };
  }

  await getDb().profile.update({ where: { id: userId }, data: parsed.data });
  revalidatePath("/[locale]/account", "layout");
  return { status: "success", savedAt: Date.now() };
}

const ADDRESS_FIELDS = [
  "label",
  "recipient",
  "phone",
  "department",
  "city",
  "line1",
  "line2",
  "notes",
] as const;

export async function saveAddressAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await sessionUserId();
  if (!userId) return { status: "error", error: "generic" };

  const values = {
    ...formValues(formData, ADDRESS_FIELDS),
    isDefault: formData.get("isDefault") === "on" ? "on" : "",
  };
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: accountFieldErrors(parsed.error) };
  }

  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue !== "" ? idValue : null;
  if (id && !z.uuid().safeParse(id).success) return { status: "error", error: "notFound" };

  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (!id && count >= MAX_ADDRESSES) return "limit" as const;
    // The first address is always the default one.
    const isDefault = parsed.data.isDefault || count === 0 || (count === 1 && Boolean(id));

    if (isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    if (id) {
      // userId in the filter: users can only edit their own addresses.
      const updated = await tx.address.updateMany({
        where: { id, userId },
        data: { ...parsed.data, ...(isDefault ? { isDefault: true } : { isDefault: undefined }) },
      });
      if (updated.count === 0) return "notFound" as const;
    } else {
      await tx.address.create({ data: { ...parsed.data, isDefault, userId } });
    }
    return "ok" as const;
  });

  if (result !== "ok") return { status: "error", error: result };
  revalidatePath(ADDRESSES_PATH, "page");
  return { status: "success", savedAt: Date.now() };
}

function addressIdFrom(formData: FormData): string | null {
  const parsed = z.uuid().safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

export async function deleteAddressAction(formData: FormData) {
  const userId = await sessionUserId();
  const id = addressIdFrom(formData);
  if (!userId || !id) return;

  await getDb().$transaction(async (tx) => {
    const removed = await tx.address.deleteMany({ where: { id, userId } });
    if (removed.count === 0) return;
    // Keep one default address while the user has any.
    const hasDefault = await tx.address.count({ where: { userId, isDefault: true } });
    if (hasDefault === 0) {
      const latest = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (latest) await tx.address.update({ where: { id: latest.id }, data: { isDefault: true } });
    }
  });
  revalidatePath(ADDRESSES_PATH, "page");
}

export async function setDefaultAddressAction(formData: FormData) {
  const userId = await sessionUserId();
  const id = addressIdFrom(formData);
  if (!userId || !id) return;

  await getDb().$transaction(async (tx) => {
    const target = await tx.address.count({ where: { id, userId } });
    if (target === 0) return;
    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await tx.address.update({ where: { id }, data: { isDefault: true } });
  });
  revalidatePath(ADDRESSES_PATH, "page");
}

export type ToggleFavoriteResult =
  { ok: true; favorited: boolean } | { ok: false; reason: "auth" | "invalid" };

export async function toggleFavoriteAction(productId: string): Promise<ToggleFavoriteResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, reason: "auth" };
  if (!z.uuid().safeParse(productId).success) return { ok: false, reason: "invalid" };

  const db = getDb();
  const removed = await db.favorite.deleteMany({ where: { userId, productId } });
  let favorited = false;
  if (removed.count === 0) {
    const product = await db.product.count({ where: { id: productId, isActive: true } });
    if (product === 0) return { ok: false, reason: "invalid" };
    // createMany + skipDuplicates: a double click never fails on the composite key.
    await db.favorite.createMany({ data: [{ userId, productId }], skipDuplicates: true });
    favorited = true;
  }

  revalidatePath("/[locale]/account/favorites", "page");
  return { ok: true, favorited };
}
