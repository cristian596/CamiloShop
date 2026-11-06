"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import {
  Field,
  FormMessage,
  PasswordInput,
  SubmitButton,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import {
  demoLoginAction,
  forgotPasswordAction,
  googleSignInAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type AuthFormState,
} from "./actions";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type AuthErrorKey } from "./schemas";

const initialState: AuthFormState = { status: "idle" };
const linkClass = cn(
  "rounded-sm font-medium text-primary-fg underline-offset-4 hover:underline",
  focusRing,
);

function useErrorText() {
  const t = useTranslations("Auth");
  return (key: AuthErrorKey | undefined) => (key ? t(`errors.${key}`) : undefined);
}

function LegalLinks({ messageKey }: { messageKey: "acceptPrivacy" | "googleLegalNote" }) {
  const t = useTranslations("Auth");
  return t.rich(messageKey, {
    terms: (chunks) => (
      <Link href="/legal/terms" target="_blank" className={linkClass}>
        {chunks}
      </Link>
    ),
    privacy: (chunks) => (
      <Link href="/legal/privacy" target="_blank" className={linkClass}>
        {chunks}
      </Link>
    ),
  });
}

function Divider() {
  const t = useTranslations("Auth");
  return (
    <div className="flex items-center gap-3 text-xs text-muted uppercase" role="separator">
      <span className="h-px flex-1 bg-line" />
      {t("or")}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  );
}

/** Google OAuth button. On sign-up it forwards the privacy checkbox value. */
function GoogleButton({
  next,
  intent,
  acceptPrivacy,
  onError,
}: {
  next?: string;
  intent: "login" | "register";
  acceptPrivacy?: boolean;
  onError?: (state: AuthFormState) => ReactNode;
}) {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(googleSignInAction, initialState);

  return (
    <form action={action} onSubmit={submitWithoutReset(action)} className="flex flex-col gap-3">
      <input type="hidden" name="intent" value={intent} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {acceptPrivacy ? <input type="hidden" name="acceptPrivacy" value="on" /> : null}
      <SubmitButton pending={pending} variant="outline" pendingLabel={t("pending")}>
        <GoogleIcon />
        {t("google")}
      </SubmitButton>
      {onError?.(state)}
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
    </form>
  );
}

export function DemoLoginButton({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(demoLoginAction, initialState);

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-2 rounded-2xl border border-cyan-fg/40 p-4"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <p className="text-sm text-muted">{t("demoHint")}</p>
      <SubmitButton
        pending={pending}
        variant="outline"
        pendingLabel={t("pending")}
        className="border-cyan-fg/60"
      >
        {t("demo")}
      </SubmitButton>
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
    </form>
  );
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(loginAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-6">
      {initialError && state.status === "idle" ? (
        <FormMessage tone="error">{initialError}</FormMessage>
      ) : null}
      <DemoLoginButton next={next} />
      <Divider />
      <form
        action={action}
        onSubmit={submitWithoutReset(action)}
        className="flex flex-col gap-4"
        noValidate
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
        <Field label={t("email")} error={errorText(fieldErrors.email)}>
          {(props) => (
            <TextInput
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state.values?.email}
            />
          )}
        </Field>
        <Field label={t("password")} error={errorText(fieldErrors.password)}>
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="current-password"
              required
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
            />
          )}
        </Field>
        <Link href="/forgot-password" className={cn(linkClass, "self-end text-sm")}>
          {t("forgotLink")}
        </Link>
        <SubmitButton pending={pending} pendingLabel={t("pending")}>
          {t("submitLogin")}
        </SubmitButton>
      </form>
      <Divider />
      <div className="flex flex-col gap-3">
        <GoogleButton next={next} intent="login" />
        <p className="text-center text-xs text-muted">
          <LegalLinks messageKey="googleLegalNote" />
        </p>
      </div>
      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link
          href={next ? { pathname: "/register", query: { next } } : "/register"}
          className={linkClass}
        >
          {t("registerLink")}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(registerAction, initialState);
  const [accepted, setAccepted] = useState(false);
  const fieldErrors = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <FormMessage tone="success">
        <p className="font-semibold">{t("checkEmailTitle")}</p>
        <p className="mt-1">{t("checkEmailText", { email: state.values?.email ?? "" })}</p>
      </FormMessage>
    );
  }

  const privacyError = errorText(fieldErrors.acceptPrivacy);

  return (
    <div className="flex flex-col gap-6">
      <form
        action={action}
        onSubmit={submitWithoutReset(action)}
        className="flex flex-col gap-4"
        noValidate
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
        <Field label={t("fullName")} error={errorText(fieldErrors.fullName)}>
          {(props) => (
            <TextInput
              {...props}
              name="fullName"
              autoComplete="name"
              required
              maxLength={80}
              defaultValue={state.values?.fullName}
            />
          )}
        </Field>
        <Field label={t("email")} error={errorText(fieldErrors.email)}>
          {(props) => (
            <TextInput
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state.values?.email}
            />
          )}
        </Field>
        <Field
          label={t("password")}
          hint={t("passwordHint")}
          error={errorText(fieldErrors.password)}
        >
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="acceptPrivacy"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              aria-invalid={privacyError ? true : undefined}
              aria-describedby={privacyError ? "privacy-error" : undefined}
              className={cn("mt-0.5 size-4 shrink-0 accent-primary", focusRing)}
            />
            <span className="text-muted">
              <LegalLinks messageKey="acceptPrivacy" />
            </span>
          </label>
          {privacyError ? (
            <p id="privacy-error" className="text-xs font-medium text-pink-fg">
              {privacyError}
            </p>
          ) : null}
        </div>
        <SubmitButton pending={pending} pendingLabel={t("pending")}>
          {t("submitRegister")}
        </SubmitButton>
      </form>
      <Divider />
      <GoogleButton
        next={next}
        intent="register"
        acceptPrivacy={accepted}
        onError={(googleState) =>
          googleState.fieldErrors?.acceptPrivacy ? (
            <FormMessage tone="error">
              {errorText(googleState.fieldErrors.acceptPrivacy)}
            </FormMessage>
          ) : null
        }
      />
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link
          href={next ? { pathname: "/login", query: { next } } : "/login"}
          className={linkClass}
        >
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">
          <p className="font-semibold">{t("forgotSentTitle")}</p>
          <p className="mt-1">{t("forgotSentText", { email: state.values?.email ?? "" })}</p>
        </FormMessage>
        <Link href="/login" className={buttonClasses({ variant: "outline" })}>
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-4"
      noValidate
    >
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
      <Field label={t("email")} error={errorText(state.fieldErrors?.email)}>
        {(props) => (
          <TextInput
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.values?.email}
          />
        )}
      </Field>
      <SubmitButton pending={pending} pendingLabel={t("pending")}>
        {t("submitForgot")}
      </SubmitButton>
      <Link href="/login" className={cn(linkClass, "self-center text-sm")}>
        {t("backToLogin")}
      </Link>
    </form>
  );
}

/** New password form, used after a recovery link and from the profile page. */
export function ResetPasswordForm({ successLink = true }: { successLink?: boolean }) {
  const t = useTranslations("Auth");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  if (state.status === "success" && successLink) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">
          <p className="font-semibold">{t("resetDoneTitle")}</p>
          <p className="mt-1">{t("resetDoneText")}</p>
        </FormMessage>
        <Link href="/account" className={buttonClasses()}>
          {t("goToAccount")}
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-4"
      noValidate
    >
      {state.status === "success" ? (
        <FormMessage tone="success">{t("resetDoneTitle")}</FormMessage>
      ) : null}
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
      <Field
        label={t("newPassword")}
        hint={t("passwordHint")}
        error={errorText(fieldErrors.password)}
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
      <Field label={t("confirmPassword")} error={errorText(fieldErrors.confirmPassword)}>
        {(props) => (
          <PasswordInput
            {...props}
            name="confirmPassword"
            autoComplete="new-password"
            required
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
      <SubmitButton pending={pending} pendingLabel={t("pending")}>
        {t("submitReset")}
      </SubmitButton>
    </form>
  );
}
