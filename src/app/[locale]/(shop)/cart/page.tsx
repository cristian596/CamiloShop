import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { CartView } from "@/features/cart/cart-view";

interface CartPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Cart" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The cart lives in the browser; this page only renders the client view. */
export default async function CartPage({ params }: CartPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Cart");

  return (
    <Container className="py-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <CartView />
    </Container>
  );
}
