import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth cookie on the outgoing response and returns the
 * verified JWT claims (null when signed out or when Supabase is not configured).
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response, claims: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        // Cache-Control etc., so no CDN ever caches a response that sets a session.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() validates the JWT and triggers a refresh when it is about to expire.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}

/** Role hint from the Custom Access Token Hook. Only for redirects, never for authorization. */
export function roleFromClaims(claims: JwtPayload | null): "admin" | "customer" | null {
  if (!claims) return null;
  const role = (claims.app_metadata as { user_role?: unknown } | undefined)?.user_role;
  return role === "admin" ? "admin" : "customer";
}
