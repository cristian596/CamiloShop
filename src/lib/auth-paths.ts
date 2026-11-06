import { routing, type Locale } from "@/i18n/routing";

/** Paths (without the locale prefix) that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/account", "/admin", "/checkout"] as const;
/** Paths that only make sense signed out; signed-in users go to their account. */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const;

export const DEFAULT_AFTER_LOGIN = "/account";

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Splits "/es/account/orders" into { locale: "es", path: "/account/orders" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return { locale: first as Locale, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  }
  return { locale: routing.defaultLocale, path: pathname || "/" };
}

export function isProtectedPath(path: string) {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

export function isAdminPath(path: string) {
  return matchesPrefix(path, "/admin");
}

export function isGuestOnlyPath(path: string) {
  return GUEST_ONLY_PATHS.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * Accepts only same-origin relative paths for post-login redirects, so a crafted
 * ?next= can never send the user to another site ("//evil.com", "/\\evil.com").
 */
export function safeNextPath(value: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

/** Removes a leading locale so the path can be passed to next-intl's redirect. */
export function stripLocale(path: string): string {
  return splitLocale(path).path;
}
