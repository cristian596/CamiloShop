import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { safeNextPath } from "@/lib/auth-paths";
import { RegisterForm } from "@/features/auth/auth-forms";
import { AuthShell } from "@/features/auth/auth-shell";

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("registerTitle"), robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <RegisterForm next={query.next ? safeNextPath(query.next) : undefined} />
    </AuthShell>
  );
}
