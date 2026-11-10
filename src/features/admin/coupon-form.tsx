"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import {
  Field,
  FormMessage,
  Select,
  SubmitButton,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { deleteCouponAction, saveCouponAction } from "./coupon-actions";
import type { AdminFormState } from "./product-schema";

export interface CouponFormValues {
  id?: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  maxUses: string;
  minSubtotal: string;
  usedCount: number;
}

const initialState: AdminFormState = { status: "idle" };

export function CouponForm({ values }: { values: CouponFormValues }) {
  const t = useTranslations("Admin.coupons");
  const te = useTranslations("Admin.errors");
  const [state, dispatch, pending] = useActionState(saveCouponAction, initialState);
  const [deleteState, deleteDispatch, deleting] = useActionState(deleteCouponAction, initialState);
  const errors = state.fieldErrors ?? {};
  const err = (field: string) => (errors[field] ? te(errors[field]) : undefined);
  const isNew = !values.id;

  return (
    <div className="flex flex-col gap-4">
      <form
        // New coupons start empty again after each creation.
        key={isNew ? (state.savedAt ?? "new") : values.id}
        action={dispatch}
        onSubmit={submitWithoutReset(dispatch)}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {values.id ? <input type="hidden" name="couponId" value={values.id} /> : null}
        <Field label={t("code")} hint={t("codeHint")} error={err("code")}>
          {(props) => (
            <TextInput
              {...props}
              name="code"
              defaultValue={values.code}
              maxLength={32}
              className="uppercase"
            />
          )}
        </Field>
        <Field label={t("type")} error={err("type")}>
          {(props) => (
            <Select {...props} name="type" defaultValue={values.type}>
              <option value="PERCENT">{t("types.PERCENT")}</option>
              <option value="FIXED">{t("types.FIXED")}</option>
            </Select>
          )}
        </Field>
        <Field label={t("value")} hint={t("valueHint")} error={err("value")}>
          {(props) => (
            <TextInput {...props} name="value" inputMode="numeric" defaultValue={values.value} />
          )}
        </Field>
        <Field label={t("minSubtotal")} error={err("minSubtotal")}>
          {(props) => (
            <TextInput
              {...props}
              name="minSubtotal"
              inputMode="numeric"
              defaultValue={values.minSubtotal}
            />
          )}
        </Field>
        <Field label={t("startsAt")} hint={t("timeHint")} error={err("startsAt")}>
          {(props) => (
            <TextInput
              {...props}
              type="datetime-local"
              name="startsAt"
              defaultValue={values.startsAt}
            />
          )}
        </Field>
        <Field label={t("endsAt")} hint={t("timeHint")} error={err("endsAt")}>
          {(props) => (
            <TextInput
              {...props}
              type="datetime-local"
              name="endsAt"
              defaultValue={values.endsAt}
            />
          )}
        </Field>
        <Field label={t("maxUses")} hint={t("maxUsesHint")} error={err("maxUses")}>
          {(props) => (
            <TextInput
              {...props}
              name="maxUses"
              inputMode="numeric"
              defaultValue={values.maxUses}
            />
          )}
        </Field>
        <label className="flex items-center gap-2 self-center text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={values.isActive}
            className="size-4 accent-primary"
          />
          {t("isActive")}
        </label>
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4">
          {state.status === "error" && state.error ? (
            <FormMessage tone="error">{te(state.error)}</FormMessage>
          ) : null}
          {state.status === "success" ? (
            <FormMessage tone="success">{t(isNew ? "created" : "saved")}</FormMessage>
          ) : null}
          <SubmitButton
            pending={pending}
            pendingLabel={t("saving")}
            className="sm:w-auto sm:self-end"
          >
            {isNew ? t("create") : t("save")}
          </SubmitButton>
        </div>
      </form>

      {values.id ? (
        values.usedCount > 0 ? (
          <p className="text-xs text-muted">{t("cannotDelete")}</p>
        ) : (
          <form
            action={deleteDispatch}
            onSubmit={(event) => {
              if (!window.confirm(t("confirmDelete"))) event.preventDefault();
            }}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="couponId" value={values.id} />
            {deleteState.status === "error" && deleteState.error ? (
              <FormMessage tone="error">{te(deleteState.error)}</FormMessage>
            ) : null}
            <button
              type="submit"
              disabled={deleting}
              className={buttonClasses({ variant: "ghost", size: "sm", className: "self-start" })}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("delete")}
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}
