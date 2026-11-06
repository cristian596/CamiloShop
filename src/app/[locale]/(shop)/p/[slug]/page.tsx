import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categoryHref } from "@/config/categories";
import type { Locale } from "@/i18n/routing";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { RatingStars } from "@/components/ui/rating-stars";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGridSkeleton } from "@/components/layout/page-skeleton";
import { ProductGallery } from "@/features/catalog/product-gallery";
import { ProductGrid } from "@/features/catalog/product-grid";
import { PurchasePanel } from "@/features/catalog/purchase-panel";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteButton } from "@/features/account/favorite-button";
import {
  getProductDetail,
  getRelatedProducts,
  isFavoriteProduct,
  type ProductDetail,
} from "@/features/catalog/queries";
import { RecentlyViewed, RecordProductView } from "@/features/catalog/recently-viewed";
import { ShareButton } from "@/features/catalog/share-button";
import { getDefaultSelection, selectionFromSku } from "@/features/catalog/variants";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const product = await getProductDetail(slug);
  if (!product) return {};

  const path = `/p/${product.slug}`;
  const image = product.images[0];

  return {
    title: product.name[locale],
    description: product.description[locale],
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { es: `/es${path}`, en: `/en${path}` },
    },
    openGraph: {
      type: "website",
      title: product.name[locale],
      description: product.description[locale],
      url: `/${locale}${path}`,
      images: image
        ? [
            {
              url: `${image.url}?w=1200&h=630&fit=crop&auto=format`,
              width: 1200,
              height: 630,
              alt: image.alt[locale],
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  // Resolved before anything streams so unknown or inactive products return a real 404.
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const [{ variant: rawVariant }, t, user] = await Promise.all([
    searchParams,
    getTranslations("Product"),
    getCurrentUser(),
  ]);
  const favorited = user ? await isFavoriteProduct(user.id, product.id) : false;
  const sku = Array.isArray(rawVariant) ? rawVariant[0] : rawVariant;
  const initialSelection =
    selectionFromSku(product.variants, sku) ?? getDefaultSelection(product.variants);

  const name = product.name[locale];
  const breadcrumbs: BreadcrumbItem[] = [
    ...(product.rootCategory
      ? [
          {
            label: product.rootCategory.name[locale],
            href: categoryHref(product.rootCategory.slug),
          },
          {
            label: product.category.name[locale],
            href: categoryHref(product.rootCategory.slug, product.category.slug),
          },
        ]
      : [{ label: product.category.name[locale], href: categoryHref(product.category.slug) }]),
    { label: name },
  ];

  return (
    <>
      <RecordProductView
        item={{
          slug: product.slug,
          name: product.name,
          brand: product.brand.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          image: product.images[0]
            ? { url: product.images[0].url, alt: product.images[0].alt }
            : null,
        }}
      />

      <Container className="py-8">
        <Breadcrumbs items={breadcrumbs} className="mb-8" />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ProductGallery images={product.images} />

          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-3">
              <p className="text-sm font-semibold tracking-wide text-primary-fg uppercase">
                {product.brand.name}
              </p>
              <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                {name}
              </h1>
              {product.ratingCount > 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <RatingStars
                    rating={product.ratingAvg}
                    label={t("rating", {
                      rating: product.ratingAvg.toLocaleString(locale, {
                        maximumFractionDigits: 1,
                      }),
                      count: product.ratingCount,
                    })}
                  />
                  <span aria-hidden="true">
                    {product.ratingAvg.toLocaleString(locale, { maximumFractionDigits: 1 })}{" "}
                    {t("ratingShort", { count: product.ratingCount })}
                  </span>
                </div>
              ) : null}
            </header>

            <PurchasePanel
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              variants={product.variants}
              initialSelection={initialSelection}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <FavoriteButton
                productId={product.id}
                initialFavorited={favorited}
                signedIn={Boolean(user)}
                locale={locale}
              />
              <ShareButton name={name} />
            </div>

            <section aria-labelledby="description-title" className="border-t border-line pt-6">
              <h2 id="description-title" className="mb-3 font-display text-lg font-semibold">
                {t("description")}
              </h2>
              <p className="leading-relaxed text-muted">{product.description[locale]}</p>
            </section>

            <section aria-labelledby="details-title" className="border-t border-line pt-6">
              <h2 id="details-title" className="mb-3 font-display text-lg font-semibold">
                {t("details")}
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted">{t("brand")}</dt>
                <dd>{product.brand.name}</dd>
                <dt className="text-muted">{t("category")}</dt>
                <dd>{product.category.name[locale]}</dd>
              </dl>
            </section>
          </div>
        </div>
      </Container>

      <section aria-labelledby="related-title" className="py-12">
        <Container>
          <SectionHeading id="related-title" title={t("related")} />
          <Suspense fallback={<ProductGridSkeleton count={4} />}>
            <RelatedProducts product={product} />
          </Suspense>
        </Container>
      </section>

      <RecentlyViewed excludeSlug={product.slug} />
    </>
  );
}

async function RelatedProducts({ product }: { product: ProductDetail }) {
  const related = await getRelatedProducts(product);
  return <ProductGrid products={related} priorityCount={0} />;
}
