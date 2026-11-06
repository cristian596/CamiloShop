import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { ResetPasswordForm } from "@/features/auth/auth-forms";
import { AuthShell } from "@/features/auth/auth-shell";

interface ResetPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ResetPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("resetTitle"), robots: { index: false, follow: false } };
}

/** Reached from the recovery email: /auth/callback opened a session first. */
export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, user] = await Promise.all([getTranslations("Auth"), getCurrentUser()]);

  return (
    <AuthShell title={t("resetTitle")} subtitle={user ? t("resetSubtitle") : undefined}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-4">
          <FormMessage tone="error">{t("resetNoSession")}</FormMessage>
          <Link href="/forgot-password" className={buttonClasses()}>
            {t("requestNewLink")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
