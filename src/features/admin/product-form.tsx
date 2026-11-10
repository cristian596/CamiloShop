"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { COLORS, type ColorKey } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import {
  Field,
  FormMessage,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  inputClasses,
  submitWithoutReset,
} from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import { saveProductAction } from "./product-actions";
import type { ProductFormOptions } from "./product-queries";
import { MAX_VARIANTS, slugify, type AdminFormState } from "./product-schema";
import { cardClass } from "./ui";

export interface ProductFormValues {
  id?: string;
  nameEs: string;
  nameEn: string;
  slug: string;
  descriptionEs: string;
  descriptionEn: string;
  categoryId: string;
  brandId: string;
  price: string;
  compareAtPrice: string;
  isActive: boolean;
  isFeatured: boolean;
  variants: VariantRow[];
}

interface VariantRow {
  key: string;
  id?: string;
  sku: string;
  size: string;
  color: string;
  priceOverride: string;
  stock: string;
  /** Ordered at least once: it cannot be removed, only set to 0 stock. */
  locked: boolean;
}

let rowCounter = 0;
const newRow = (sku = ""): VariantRow => ({
  key: `new-${(rowCounter += 1)}`,
  sku,
  size: "",
  color: "",
  priceOverride: "",
  stock: "0",
  locked: false,
});

export function ProductForm({
  initial,
  options,
}: {
  initial: ProductFormValues;
  options: ProductFormOptions;
}) {
  const t = useTranslations("Admin.products");
  const te = useTranslations("Admin.errors");
  const tc = useTranslations("Colors");
  const locale = useLocale();
  const [state, dispatch, pending] = useActionState<AdminFormState, FormData>(saveProductAction, {
    status: "idle",
  });
  const [variants, setVariants] = useState<VariantRow[]>(
    initial.variants.length > 0 ? initial.variants : [newRow()],
  );
  const [nameEs, setNameEs] = useState(initial.nameEs);
  const [slug, setSlug] = useState(initial.slug);
  const errors = state.fieldErrors ?? {};
  const err = (field: string) => (errors[field] ? te(errors[field]) : undefined);
  const name = (row: { nameEs: string; nameEn: string }) =>
    locale === "en" ? row.nameEn : row.nameEs;

  const updateRow = (key: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const serialized = JSON.stringify(
    variants.map(({ id, sku, size, color, priceOverride, stock }) => ({
      ...(id ? { id } : {}),
      sku,
      size,
      color,
      priceOverride,
      stock,
    })),
  );

  return (
    <form
      action={dispatch}
      onSubmit={submitWithoutReset(dispatch)}
      className="flex flex-col gap-6"
      noValidate
    >
      {initial.id ? <input type="hidden" name="productId" value={initial.id} /> : null}
      <input type="hidden" name="variants" value={serialized} />

      {state.status === "error" ? (
        <FormMessage tone="error">{te(state.error ?? "invalid")}</FormMessage>
      ) : null}

      <section className={cn(cardClass, "grid gap-4 md:grid-cols-2")} aria-labelledby="basics">
        <h2 id="basics" className="font-semibold md:col-span-2">
          {t("basics")}
        </h2>
        <Field label={t("nameEs")} error={err("nameEs")}>
          {(props) => (
            <TextInput
              {...props}
              name="nameEs"
              value={nameEs}
              maxLength={120}
              required
              onChange={(event) => setNameEs(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("nameEn")} error={err("nameEn")}>
          {(props) => (
            <TextInput
              {...props}
              name="nameEn"
              defaultValue={initial.nameEn}
              maxLength={120}
              required
            />
          )}
        </Field>
        <Field
          label={t("slug")}
          hint={t("slugHint", { slug: slug || slugify(nameEs) || "…" })}
          error={err("slug")}
        >
          {(props) => (
            <TextInput
              {...props}
              name="slug"
              value={slug}
              maxLength={80}
              placeholder={slugify(nameEs)}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
          )}
        </Field>
        <Field label={t("category")} error={err("categoryId")}>
          {(props) => (
            <Select {...props} name="categoryId" defaultValue={initial.categoryId} required>
              <option value="">{t("choose")}</option>
              {options.roots.map((root) => (
                <optgroup key={root.id} label={name(root)}>
                  {root.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {name(child)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("brand")} error={err("brandId")}>
          {(props) => (
            <Select {...props} name="brandId" defaultValue={initial.brandId} required>
              <option value="">{t("choose")}</option>
              {options.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("price")} hint={t("priceHint")} error={err("price")}>
            {(props) => (
              <TextInput
                {...props}
                name="price"
                inputMode="numeric"
                defaultValue={initial.price}
                required
              />
            )}
          </Field>
          <Field label={t("compareAt")} hint={t("compareAtHint")} error={err("compareAtPrice")}>
            {(props) => (
              <TextInput
                {...props}
                name="compareAtPrice"
                inputMode="numeric"
                defaultValue={initial.compareAtPrice}
              />
            )}
          </Field>
        </div>
        <Field label={t("descriptionEs")} error={err("descriptionEs")}>
          {(props) => (
            <TextArea
              {...props}
              name="descriptionEs"
              rows={5}
              maxLength={4000}
              defaultValue={initial.descriptionEs}
              required
            />
          )}
        </Field>
        <Field label={t("descriptionEn")} error={err("descriptionEn")}>
          {(props) => (
            <TextArea
              {...props}
              name="descriptionEn"
              rows={5}
              maxLength={4000}
              defaultValue={initial.descriptionEn}
              required
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-6 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initial.isActive}
              className="size-4 accent-primary"
            />
            {t("isActive")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={initial.isFeatured}
              className="size-4 accent-primary"
            />
            {t("isFeatured")}
          </label>
        </div>
      </section>

      <section className={cn(cardClass, "flex flex-col gap-4")} aria-labelledby="variants-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="variants-title" className="font-semibold">
              {t("variants")}
            </h2>
            <p className="text-sm text-muted">{t("variantsHint")}</p>
          </div>
          <button
            type="button"
            disabled={variants.length >= MAX_VARIANTS}
            onClick={() => setVariants((rows) => [...rows, newRow()])}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("addVariant")}
          </button>
        </div>
        {err("variants") ? <FormMessage tone="error">{err("variants")}</FormMessage> : null}

        <ul className="flex flex-col gap-3">
          {variants.map((row, index) => {
            const rowError = (field: string) => err(`variants.${index}.${field}`);
            return (
              <li
                key={row.key}
                className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr_0.8fr_auto] lg:items-end"
              >
                <Field label={t("sku")} error={rowError("sku")}>
                  {(props) => (
                    <TextInput
                      {...props}
                      value={row.sku}
                      maxLength={40}
                      onChange={(event) =>
                        updateRow(row.key, { sku: event.target.value.toUpperCase() })
                      }
                    />
                  )}
                </Field>
                <Field label={t("size")} error={rowError("size")}>
                  {(props) => (
                    <TextInput
                      {...props}
                      value={row.size}
                      maxLength={20}
                      placeholder="M, 42, 128 GB"
                      onChange={(event) => updateRow(row.key, { size: event.target.value })}
                    />
                  )}
                </Field>
                <Field label={t("color")} error={rowError("color")}>
                  {(props) => (
                    <select
                      {...props}
                      value={row.color}
                      onChange={(event) => updateRow(row.key, { color: event.target.value })}
                      className={inputClasses}
                    >
                      <option value="">{t("noColor")}</option>
                      {(Object.keys(COLORS) as ColorKey[]).map((color) => (
                        <option key={color} value={color}>
                          {tc(color)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t("priceOverride")} error={rowError("priceOverride")}>
                  {(props) => (
                    <TextInput
                      {...props}
                      value={row.priceOverride}
                      inputMode="numeric"
                      placeholder={t("samePrice")}
                      onChange={(event) =>
                        updateRow(row.key, { priceOverride: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label={t("stock")} error={rowError("stock")}>
                  {(props) => (
                    <TextInput
                      {...props}
                      value={row.stock}
                      inputMode="numeric"
                      onChange={(event) => updateRow(row.key, { stock: event.target.value })}
                    />
                  )}
                </Field>
                <button
                  type="button"
                  disabled={row.locked || variants.length === 1}
                  title={row.locked ? t("variantLocked") : undefined}
                  aria-label={t("removeVariant", { index: index + 1 })}
                  onClick={() => setVariants((rows) => rows.filter((item) => item.key !== row.key))}
                  className={cn(
                    "grid size-11 place-items-center rounded-full border border-line text-muted hover:text-pink-fg disabled:opacity-40",
                    focusRing,
                  )}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        {variants.some((row) => row.locked) ? (
          <p className="text-xs text-muted">{t("variantLocked")}</p>
        ) : null}
      </section>

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel={t("saving")} className="sm:w-auto">
          {initial.id ? t("save") : t("create")}
        </SubmitButton>
      </div>
    </form>
  );
}
