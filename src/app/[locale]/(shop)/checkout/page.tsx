import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { CheckoutForm } from "@/features/checkout/checkout-form";

interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Checkout" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** No guest checkout: the middleware and requireUser() both send guests to the login. */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/checkout");

  const db = getDb();
  const [t, addresses, rates] = await Promise.all([
    getTranslations("Checkout"),
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
    db.shippingRate.findMany({
      where: { city: { not: "DEFAULT" } },
      orderBy: { city: "asc" },
      select: { city: true },
    }),
  ]);

  return (
    <Container className="py-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <CheckoutForm addresses={addresses} cities={rates.map((rate) => rate.city)} />
    </Container>
  );
}
