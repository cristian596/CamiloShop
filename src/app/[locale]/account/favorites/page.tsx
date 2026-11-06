import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { buttonClasses } from "@/components/ui/button";
import { ProductGrid } from "@/features/catalog/product-grid";
import { getFavoriteProducts } from "@/features/catalog/queries";

interface FavoritesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FavoritesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("favorites") };
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/account/favorites");
  const [t, products] = await Promise.all([
    getTranslations("Account"),
    getFavoriteProducts(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("favoritesTitle")}</h1>
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <Heart className="size-8 text-pink-fg" aria-hidden="true" />
          <p className="max-w-sm text-muted">{t("noFavorites")}</p>
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            {t("exploreProducts")}
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} priorityCount={0} />
      )}
    </div>
  );
}
