import "server-only";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

/**
 * Sends the welcome email at most once per profile. Claiming welcomeEmailSentAt
 * with a conditional update makes concurrent sign-in callbacks send only one.
 * A failed send is logged and not retried (sendEmail never throws).
 */
export async function sendWelcomeOnce(userId: string, locale?: Locale) {
  const db = getDb();
  const claimed = await db.profile.updateMany({
    where: { id: userId, welcomeEmailSentAt: null },
    data: { welcomeEmailSentAt: new Date(), ...(locale ? { locale } : {}) },
  });
  if (claimed.count === 0) return;

  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true, locale: true },
  });
  if (!profile) return;

  await sendEmail(
    welcomeEmail({
      to: profile.email,
      name: profile.fullName,
      locale: profile.locale === "en" ? "en" : "es",
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
    }),
  );
}
