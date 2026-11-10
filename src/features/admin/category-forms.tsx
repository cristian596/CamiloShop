"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, TextInput, submitWithoutReset } from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "./category-actions";
import type { AdminFormState } from "./product-schema";

interface CategoryValues {
  id: string;
  nameEs: string;
  nameEn: string;
  slug: string;
  position: number;
  productCount: number;
  isRoot: boolean;
}

const initialState: AdminFormState = { status: "idle" };

function CategoryFields({
  values,
  errors,
  slugLocked,
}: {
  values?: Partial<CategoryValues>;
  errors: AdminFormState["fieldErrors"];
  slugLocked?: boolean;
}) {
  const t = useTranslations("Admin.categories");
  const te = useTranslations("Admin.errors");
  const err = (field: string) => (errors?.[field] ? te(errors[field]) : undefined);
  return (
    <>
      <Field label={t("nameEs")} error={err("nameEs")}>
        {(props) => (
          <TextInput {...props} name="nameEs" defaultValue={values?.nameEs} maxLength={60} />
        )}
      </Field>
      <Field label={t("nameEn")} error={err("nameEn")}>
        {(props) => (
          <TextInput {...props} name="nameEn" defaultValue={values?.nameEn} maxLength={60} />
        )}
      </Field>
      <Field label={t("slug")} error={err("slug")}>
        {(props) => (
          <TextInput
            {...props}
            name="slug"
            defaultValue={values?.slug}
            maxLength={80}
            readOnly={slugLocked}
            className={slugLocked ? "text-muted" : undefined}
          />
        )}
      </Field>
      <Field label={t("position")} error={err("position")}>
        {(props) => (
          <TextInput
            {...props}
            name="position"
            inputMode="numeric"
            defaultValue={values?.position ?? 0}
          />
        )}
      </Field>
    </>
  );
}

export function CategoryEditor({ category }: { category: CategoryValues }) {
  const t = useTranslations("Admin.categories");
  const te = useTranslations("Admin.errors");
  const [state, dispatch, pending] = useActionState(updateCategoryAction, initialState);
  const [deleteState, deleteDispatch, deleting] = useActionState(
    deleteCategoryAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-3">
      <form
        action={dispatch}
        onSubmit={submitWithoutReset(dispatch)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_90px_auto] lg:items-end"
      >
        <input type="hidden" name="categoryId" value={category.id} />
        <CategoryFields values={category} errors={state.fieldErrors} slugLocked={category.isRoot} />
        <button
          type="submit"
          disabled={pending}
          aria-label={t("saveNamed", { name: category.nameEs })}
          className={buttonClasses({ variant: "outline", className: "h-11" })}
        >
          <Save className="size-4" aria-hidden="true" />
          <span className="lg:sr-only">{t("save")}</span>
        </button>
      </form>
      {category.isRoot ? <p className="text-xs text-muted">{t("rootSlug")}</p> : null}
      {state.status === "error" && state.error ? (
        <FormMessage tone="error">{te(state.error)}</FormMessage>
      ) : null}
      {state.status === "success" ? <FormMessage tone="success">{t("saved")}</FormMessage> : null}
      {deleteState.status === "error" && deleteState.error ? (
        <FormMessage tone="error">{te(deleteState.error)}</FormMessage>
      ) : null}
      {!category.isRoot ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{t("productCount", { count: category.productCount })}</span>
          {category.productCount === 0 ? (
            <form
              action={deleteDispatch}
              onSubmit={(event) => {
                if (!window.confirm(t("confirmDelete"))) event.preventDefault();
              }}
            >
              <input type="hidden" name="categoryId" value={category.id} />
              <button
                type="submit"
                disabled={deleting}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 hover:text-pink-fg",
                  focusRing,
                )}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t("delete")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function NewCategoryForm({
  parentId,
  parentName,
}: {
  parentId: string;
  parentName: string;
}) {
  const t = useTranslations("Admin.categories");
  const te = useTranslations("Admin.errors");
  const [state, dispatch, pending] = useActionState(createCategoryAction, initialState);

  return (
    <details className="rounded-xl border border-dashed border-line p-3">
      <summary
        className={cn("cursor-pointer rounded text-sm font-medium text-primary-fg", focusRing)}
      >
        <Plus className="mr-1 inline size-4" aria-hidden="true" />
        {t("newIn", { parent: parentName })}
      </summary>
      {/* A new key after each creation empties the fields. */}
      <form
        key={state.savedAt ?? "new"}
        action={dispatch}
        onSubmit={submitWithoutReset(dispatch)}
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_90px_auto] lg:items-end"
      >
        <input type="hidden" name="parentId" value={parentId} />
        <CategoryFields errors={state.fieldErrors} />
        <button type="submit" disabled={pending} className={buttonClasses({ className: "h-11" })}>
          {t("create")}
        </button>
      </form>
      {state.status === "error" && state.error ? (
        <div className="mt-3">
          <FormMessage tone="error">{te(state.error)}</FormMessage>
        </div>
      ) : null}
      {state.status === "success" ? (
        <div className="mt-3">
          <FormMessage tone="success">{t("created")}</FormMessage>
        </div>
      ) : null}
    </details>
  );
}
