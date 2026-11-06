import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AddressManager } from "@/features/account/address-manager";

interface AddressesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AddressesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("addresses") };
}

export default async function AddressesPage({ params }: AddressesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/account/addresses");

  const db = getDb();
  const [t, addresses, rates] = await Promise.all([
    getTranslations("Account"),
    db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        recipient: true,
        phone: true,
        department: true,
        city: true,
        line1: true,
        line2: true,
        notes: true,
        isDefault: true,
      },
    }),
    // Cities with their own shipping rate, suggested in the city field.
    db.shippingRate.findMany({
      where: { city: { not: "DEFAULT" } },
      orderBy: { city: "asc" },
      select: { city: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("addressesTitle")}</h1>
      <AddressManager addresses={addresses} cities={rates.map((rate) => rate.city)} />
    </div>
  );
}
