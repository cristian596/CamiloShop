import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth cookie on the outgoing response.
 * Route protection by role is added in phase 3; until Supabase is configured
 * this is a no-op so the store keeps working.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() validates the JWT and triggers a refresh when it is about to expire.
  await supabase.auth.getClaims();

  return response;
}
