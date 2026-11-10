import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  DEFAULT_AFTER_LOGIN,
  isAdminPath,
  isGuestOnlyPath,
  isProtectedPath,
  splitLocale,
} from "@/lib/auth-paths";
import { roleFromClaims, updateSession } from "@/lib/supabase/middleware";

const handleI18n = createIntlMiddleware(routing);

/** Redirect that keeps the refreshed auth cookies set on `from`. */
function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  const [path, query] = pathname.split("?");
  url.pathname = path ?? "/";
  url.search = query ? `?${query}` : "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

/**
 * Locale negotiation, session refresh and route guards. The guards only improve
 * UX: every protected page and action re-checks with requireUser()/requireAdmin().
 */
export async function proxy(request: NextRequest) {
  const intlResponse = handleI18n(request);
  // next-intl is redirecting (e.g. "/" -> "/es"); the guard runs on the next request.
  if (intlResponse.headers.has("location")) return intlResponse;

  const { response, claims } = await updateSession(request, intlResponse);
  const { locale, path } = splitLocale(request.nextUrl.pathname);

  if (isProtectedPath(path) && !claims) {
    const next = encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(request, response, `/${locale}/login?next=${next}`);
  }
  // The JWT role can be up to one token lifetime stale; requireAdmin() reads the database.
  if (isAdminPath(path) && roleFromClaims(claims) !== "admin") {
    return redirectWithCookies(request, response, `/${locale}${DEFAULT_AFTER_LOGIN}`);
  }
  if (isGuestOnlyPath(path) && claims) {
    return redirectWithCookies(request, response, `/${locale}${DEFAULT_AFTER_LOGIN}`);
  }

  return response;
}

export const config = {
  // Skip API routes, auth callbacks, Next internals and files with an extension.
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
