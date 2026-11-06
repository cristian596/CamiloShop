"use server";

import { getLocale } from "next-intl/server";
import { redirect as redirectExternal } from "next/navigation";
import { LEGAL_VERSION } from "@/config/legal";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { safeNextPath, stripLocale } from "@/lib/auth-paths";
import { runInBackground } from "@/lib/background";
import { publicEnv } from "@/lib/env";
import { RATE_LIMITS, clientIpKey, consumeRateLimit } from "@/lib/rate-limit";
import { getServerEnv } from "@/lib/server-env";
import { createAdminClient, createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  authErrorKey,
  fieldErrorsFrom,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthErrorKey,
} from "./schemas";
import { sendWelcomeOnce } from "./welcome";

export interface AuthFormState {
  status: "idle" | "error" | "success";
  error?: AuthErrorKey;
  fieldErrors?: Record<string, AuthErrorKey>;
  /** Echoed back so the form keeps what the user typed (never the password). */
  values?: { email?: string; fullName?: string };
}

const fail = (error: AuthErrorKey, values?: AuthFormState["values"]): AuthFormState => ({
  status: "error",
  error,
  values,
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function callbackUrl(next: string, extra: Record<string, string> = {}) {
  const url = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url.toString();
}

/** Redirect target inside the app; `next` arrives with its locale prefix. */
async function localizedNext(formData: FormData) {
  const locale = (await getLocale()) as Locale;
  const next = safeNextPath(text(formData, "next"), `/${locale}/account`);
  return { locale, next, href: stripLocale(next) };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: text(formData, "email") };
  if (!isSupabaseConfigured()) return fail("notConfigured", values);

  const parsed = loginSchema.safeParse({
    email: values.email,
    password: text(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authErrorKey(error.code), values);

  const { locale, href } = await localizedNext(formData);
  return redirect({ href, locale });
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: text(formData, "email"), fullName: text(formData, "fullName") };
  if (!isSupabaseConfigured()) return fail("notConfigured", values);

  const parsed = registerSchema.safeParse({
    ...values,
    password: text(formData, "password"),
    acceptPrivacy: formData.get("acceptPrivacy"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { locale, next, href } = await localizedNext(formData);
  const { email, password, fullName } = parsed.data;
  const metadata = { full_name: fullName, locale, privacy_version: LEGAL_VERSION };

  if (getServerEnv().REQUIRE_EMAIL_VERIFICATION) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: callbackUrl(next) },
    });
    // Supabase answers an existing email with a fake success, so the form never
    // reveals which addresses have accounts.
    if (error) return fail(authErrorKey(error.code), values);
    return { status: "success", values: { email } };
  }

  // Demo mode without a verified email domain: the Admin API creates the user as
  // already confirmed. It bypasses Supabase's sign-up rate limits, so limit by IP.
  if (!(await consumeRateLimit(await clientIpKey(), RATE_LIMITS.register))) {
    return fail("rateLimited", values);
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (createError || !created.user) return fail(authErrorKey(createError?.code), values);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return fail(authErrorKey(signInError.code), values);

  runInBackground("welcome email", sendWelcomeOnce(created.user.id, locale));
  return redirect({ href, locale });
}

/** Starts Google OAuth. On the sign-up page the privacy checkbox must be ticked. */
export async function googleSignInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("notConfigured");

  const requiresConsent = text(formData, "intent") === "register";
  if (requiresConsent && formData.get("acceptPrivacy") !== "on") {
    return {
      status: "error",
      fieldErrors: { acceptPrivacy: "privacyRequired" },
      values: { email: text(formData, "email"), fullName: text(formData, "fullName") },
    };
  }

  const { next } = await localizedNext(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(next, requiresConsent ? { consent: LEGAL_VERSION } : {}),
    },
  });
  if (error || !data.url) return fail(authErrorKey(error?.code));

  return redirectExternal(data.url);
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: text(formData, "email") };
  if (!isSupabaseConfigured()) return fail("notConfigured", values);

  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl(`/${locale}/reset-password`, { type: "recovery" }),
  });
  // Only rate limiting is reported; unknown emails get the same success message.
  if (error && authErrorKey(error.code) === "rateLimited") return fail("rateLimited", values);
  if (error) console.error("[auth] resetPasswordForEmail failed", error.code, error.message);

  return { status: "success", values: { email: parsed.data.email } };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("notConfigured");

  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return fail("sessionExpired");
  // The demo account is shared by every visitor: its password must not change.
  const demoEmail = getServerEnv().DEMO_USER_EMAIL;
  if (demoEmail && claims.claims.email === demoEmail) return fail("demoLocked");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorKey(error.code));

  return { status: "success" };
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const locale = (await getLocale()) as Locale;
  return redirect({ href: "/", locale });
}

/**
 * Signs in as the seeded demo customer. The credentials live only in server
 * env vars, and attempts are limited per salted IP hash.
 */
export async function demoLoginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } = getServerEnv();
  if (!isSupabaseConfigured() || !DEMO_USER_EMAIL || !DEMO_USER_PASSWORD) {
    return fail("notConfigured");
  }
  if (!(await consumeRateLimit(await clientIpKey(), RATE_LIMITS.demoLogin))) {
    return fail("rateLimited");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
  });
  if (error) {
    console.error("[auth] demo sign-in failed", error.code, error.message);
    return fail("generic");
  }

  const { locale, href } = await localizedNext(formData);
  return redirect({ href, locale });
}
