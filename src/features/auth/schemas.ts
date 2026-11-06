import { z } from "zod";

/**
 * Validation shared by the auth forms and their server actions. Error messages
 * are translation keys under "Auth.errors".
 */
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt (used by Supabase Auth) ignores bytes after 72.
export const PASSWORD_MAX_LENGTH = 72;

export const emailField = z
  .string({ error: "emailInvalid" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }).max(254, { error: "emailInvalid" }));

export const passwordField = z
  .string({ error: "passwordTooShort" })
  .min(PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
  .max(PASSWORD_MAX_LENGTH, { error: "passwordTooLong" });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: "passwordRequired" }),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, { error: "nameTooShort" }).max(80, { error: "nameTooLong" }),
  email: emailField,
  password: passwordField,
  acceptPrivacy: z.literal("on", { error: "privacyRequired" }),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ password: passwordField, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });

export type AuthErrorKey =
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordMismatch"
  | "nameTooShort"
  | "nameTooLong"
  | "privacyRequired"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "emailTaken"
  | "weakPassword"
  | "samePassword"
  | "rateLimited"
  | "sessionExpired"
  | "notConfigured"
  | "demoLocked"
  | "generic";

const KNOWN_KEYS = new Set<string>([
  "emailInvalid",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "passwordMismatch",
  "nameTooShort",
  "nameTooLong",
  "privacyRequired",
]);

/** First validation error per field, as translation keys. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, AuthErrorKey> {
  const result: Record<string, AuthErrorKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (result[field]) continue;
    result[field] = (KNOWN_KEYS.has(issue.message) ? issue.message : "generic") as AuthErrorKey;
  }
  return result;
}

/** Maps Supabase Auth error codes to translation keys. */
export function authErrorKey(code: string | undefined): AuthErrorKey {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "session_not_found":
    case "session_expired":
    case "reauthentication_needed":
      return "sessionExpired";
    default:
      return "generic";
  }
}
