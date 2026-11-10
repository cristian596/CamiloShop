"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import {
  Field,
  FormMessage,
  SubmitButton,
  TextArea,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { createReviewAction, type ReviewFormState } from "./actions";
import { REVIEW_LIMITS } from "./rules";

export function ReviewForm({ productId }: { productId: string }) {
  const t = useTranslations("Reviews");
  const [state, dispatch, pending] = useActionState<ReviewFormState, FormData>(createReviewAction, {
    status: "idle",
  });
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const errors = state.fieldErrors ?? {};
  const shown = hovered || rating;

  if (state.status === "success") {
    return <FormMessage tone="success">{t("thanks")}</FormMessage>;
  }

  return (
    <form
      action={dispatch}
      onSubmit={submitWithoutReset(dispatch)}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="productId" value={productId} />
      {state.status === "error" && state.error ? (
        <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage>
      ) : null}

      <fieldset aria-describedby={errors.rating ? "rating-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">{t("yourRating")}</legend>
        {/* Native radios (keyboard: arrows) styled as stars. */}
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              onMouseEnter={() => setHovered(value)}
              className="cursor-pointer rounded-md p-0.5 has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              <span className="sr-only">{t("stars", { count: value })}</span>
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 transition-colors",
                  value <= shown ? "text-amber-500 dark:text-amber-400" : "text-line",
                )}
                fill="currentColor"
                strokeWidth={0}
              />
            </label>
          ))}
        </div>
        {errors.rating ? (
          <p id="rating-error" className="mt-1 text-xs font-medium text-pink-fg">
            {t("errors.rating")}
          </p>
        ) : null}
      </fieldset>

      <Field
        label={t("reviewTitle")}
        error={errors.title ? t(`errors.${errors.title}`) : undefined}
      >
        {(props) => <TextInput {...props} name="title" maxLength={REVIEW_LIMITS.titleMax} />}
      </Field>
      <Field
        label={t("body")}
        hint={t("bodyHint", { min: REVIEW_LIMITS.bodyMin })}
        error={errors.body ? t(`errors.${errors.body}`, { min: REVIEW_LIMITS.bodyMin }) : undefined}
      >
        {(props) => (
          <TextArea {...props} name="body" rows={4} maxLength={REVIEW_LIMITS.bodyMax} required />
        )}
      </Field>
      <SubmitButton
        pending={pending}
        pendingLabel={t("sending")}
        className="sm:w-auto sm:self-start"
      >
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
