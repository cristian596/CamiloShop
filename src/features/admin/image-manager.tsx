"use client";

import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import {
  Field,
  FormMessage,
  SubmitButton,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import { IMAGE_TYPES, MAX_IMAGES_PER_PRODUCT, MAX_IMAGE_BYTES } from "./image-file";
import {
  deleteProductImageAction,
  moveProductImageAction,
  uploadProductImageAction,
} from "./product-actions";
import type { AdminFormState } from "./product-schema";
import { cardClass } from "./ui";

interface ImageRow {
  id: string;
  url: string;
  altEs: string;
  altEn: string;
}

const iconButton = cn(
  "grid size-9 place-items-center rounded-full border border-line bg-surface text-muted hover:text-fg disabled:opacity-40",
  focusRing,
);

export function ImageManager({ productId, images }: { productId: string; images: ImageRow[] }) {
  const t = useTranslations("Admin.images");
  const te = useTranslations("Admin.errors");
  const locale = useLocale();
  const [state, dispatch, pending] = useActionState<AdminFormState, FormData>(
    uploadProductImageAction,
    {
      status: "idle",
    },
  );
  const errors = state.fieldErrors ?? {};
  const full = images.length >= MAX_IMAGES_PER_PRODUCT;

  return (
    <section className={cn(cardClass, "flex flex-col gap-5")} aria-labelledby="images-title">
      <div>
        <h2 id="images-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-raised">
                <Image
                  src={image.url}
                  alt={locale === "en" ? image.altEn : image.altEs}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                    {t("cover")}
                  </span>
                ) : null}
              </div>
              <div className="flex justify-center gap-2">
                <form action={moveProductImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    aria-label={t("moveUp", { index: index + 1 })}
                    className={iconButton}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                </form>
                <form action={moveProductImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === images.length - 1}
                    aria-label={t("moveDown", { index: index + 1 })}
                    className={iconButton}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                </form>
                <form
                  action={deleteProductImageAction}
                  onSubmit={(event) => {
                    if (!window.confirm(t("confirmDelete"))) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="imageId" value={image.id} />
                  <button
                    type="submit"
                    aria-label={t("delete", { index: index + 1 })}
                    className={cn(iconButton, "hover:text-pink-fg")}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-muted">{t("full", { max: MAX_IMAGES_PER_PRODUCT })}</p>
      ) : (
        // A new key after each upload clears the file input and the alt texts.
        <form
          key={state.savedAt ?? "upload"}
          action={dispatch}
          onSubmit={submitWithoutReset(dispatch)}
          className="grid gap-4 border-t border-line pt-5 md:grid-cols-2"
        >
          <input type="hidden" name="productId" value={productId} />
          {state.status === "error" && state.error ? (
            <div className="md:col-span-2">
              <FormMessage tone="error">{te(state.error)}</FormMessage>
            </div>
          ) : null}
          {state.status === "success" ? (
            <div className="md:col-span-2">
              <FormMessage tone="success">{t("uploaded")}</FormMessage>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Field
              label={t("file")}
              hint={t("fileHint", { mb: MAX_IMAGE_BYTES / 1024 / 1024 })}
              error={errors.file ? te(errors.file) : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  type="file"
                  name="file"
                  accept={Object.keys(IMAGE_TYPES).join(",")}
                  required
                  className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-primary"
                />
              )}
            </Field>
          </div>
          <Field label={t("altEs")} error={errors.altEs ? te(errors.altEs) : undefined}>
            {(props) => <TextInput {...props} name="altEs" maxLength={160} required />}
          </Field>
          <Field label={t("altEn")} error={errors.altEn ? te(errors.altEn) : undefined}>
            {(props) => <TextInput {...props} name="altEn" maxLength={160} required />}
          </Field>
          <div className="md:col-span-2 md:justify-self-end">
            <SubmitButton pending={pending} pendingLabel={t("uploading")} className="md:w-auto">
              <Upload className="size-4" aria-hidden="true" />
              {t("upload")}
            </SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
