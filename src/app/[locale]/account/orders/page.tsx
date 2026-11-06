import { Package } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";

interface OrdersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("orders") };
}

/** Order history arrives with checkout in phase 4. */
export default async function OrdersPage({ params }: OrdersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireUser("/account/orders");
  const t = await getTranslations("Account");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("orders")}</h1>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
        <Package className="size-8 text-cyan-fg" aria-hidden="true" />
        <p className="max-w-sm text-muted">{t("ordersComingSoon")}</p>
      </div>
    </div>
  );
}
