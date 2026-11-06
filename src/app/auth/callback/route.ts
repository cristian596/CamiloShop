import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_VERSION } from "@/config/legal";
import { safeNextPath, splitLocale } from "@/lib/auth-paths";
import { runInBackground } from "@/lib/background";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeOnce } from "@/features/auth/welcome";

export const dynamic = "force-dynamic";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

/**
 * Lands every Supabase Auth link: Google OAuth and PKCE email links (?code=) and
 * token-hash email templates (?token_hash=&type=). Opens the session, then
 * redirects to `next`, which must be a same-origin path.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"), "/es/account");
  const { locale } = splitLocale(next);
  const type = params.get("type");
  const isRecovery = type === "recovery";

  const supabase = await createClient();
  let userId: string | undefined;
  let failed = false;

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
    userId = data.user?.id;
  } else if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    failed = Boolean(error);
    userId = data.user?.id;
  } else {
    failed = true;
  }

  // Provider errors (e.g. the user cancelled Google) also arrive as ?error=.
  if (failed || !userId || params.has("error")) {
    const reason = isRecovery ? "recovery" : "link";
    return NextResponse.redirect(new URL(`/${locale}/login?error=${reason}`, request.url));
  }

  // Google sign-up from the register page: the consent checkbox was ticked there.
  if (params.get("consent") === LEGAL_VERSION) {
    await getDb().profile.updateMany({
      where: { id: userId, privacyAcceptedAt: null },
      data: { privacyAcceptedAt: new Date(), privacyVersion: LEGAL_VERSION },
    });
  }

  if (!isRecovery) runInBackground("welcome email", sendWelcomeOnce(userId, locale));

  return NextResponse.redirect(new URL(next, request.url));
}
