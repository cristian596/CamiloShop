"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  Select,
  SubmitButton,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { updateProfileAction, type AccountFormState } from "./actions";
import type { AccountErrorKey } from "./schemas";

const initialState: AccountFormState = { status: "idle" };

export function useAccountErrorText() {
  const t = useTranslations("Account");
  return (key: AccountErrorKey | undefined) => (key ? t(`errors.${key}`) : undefined);
}

export function ProfileForm({
  email,
  fullName,
  phone,
  locale,
}: {
  email: string;
  fullName: string;
  phone: string;
  locale: string;
}) {
  const t = useTranslations("Account");
  const ta = useTranslations("Auth");
  const errorText = useAccountErrorText();
  const [state, action, pending] = useActionState(updateProfileAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-4"
      noValidate
    >
      {state.status === "success" ? <FormMessage tone="success">{t("saved")}</FormMessage> : null}
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
      <Field label={ta("email")} hint={t("emailReadOnly")}>
        {(props) => <TextInput {...props} value={email} readOnly className="opacity-70" />}
      </Field>
      <Field label={ta("fullName")} error={errorText(fieldErrors.fullName)}>
        {(props) => (
          <TextInput
            {...props}
            name="fullName"
            autoComplete="name"
            maxLength={80}
            required
            defaultValue={fullName}
          />
        )}
      </Field>
      <Field label={t("phone")} hint={t("phoneHint")} error={errorText(fieldErrors.phone)}>
        {(props) => (
          <TextInput
            {...props}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            defaultValue={phone}
          />
        )}
      </Field>
      <Field label={t("language")}>
        {(props) => (
          <Select {...props} name="locale" defaultValue={locale}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </Select>
        )}
      </Field>
      <SubmitButton
        pendingLabel={ta("pending")}
        pending={pending}
        className="sm:w-auto sm:self-start"
      >
        {t("save")}
      </SubmitButton>
    </form>
  );
}
