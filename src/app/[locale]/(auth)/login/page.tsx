import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { safeNextPath } from "@/lib/auth-paths";
import { LoginForm } from "@/features/auth/auth-forms";
import { AuthShell } from "@/features/auth/auth-shell";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("loginTitle"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth");

  const next = query.next ? safeNextPath(query.next) : undefined;
  const initialError =
    query.error === "recovery" ? t("recoveryError") : query.error ? t("linkError") : undefined;

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <LoginForm next={next} initialError={initialError} />
    </AuthShell>
  );
}
