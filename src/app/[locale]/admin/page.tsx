import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { Container } from "@/components/ui/container";

interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Placeholder until the admin panel (phase 6); proves the role guard end to end. */
export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireAdmin("/admin");
  const t = await getTranslations("Admin");

  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <ShieldCheck className="size-12 text-primary-fg" aria-hidden="true" />
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="max-w-md text-muted">{t("comingSoon")}</p>
    </Container>
  );
}
