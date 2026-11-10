import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

/** Absolute URL on the public site (metadataBase only covers <head> tags). */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/**
 * canonical + hreflang for a locale-less path ("/p/gorra"). Every page exists
 * in both languages; x-default points to Spanish, the store's main language.
 */
export function localizedAlternates(locale: Locale, path: string): Metadata["alternates"] {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((code) => [code, `/${code}${suffix}`])),
      "x-default": `/${routing.defaultLocale}${suffix}`,
    },
  };
}

/** Serializes JSON-LD safely for a <script> tag ("<" cannot close it). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const ORGANIZATION_NAME = "CamiloShop";

/** Breadcrumb trail as schema.org BreadcrumbList (paths are locale-less). */
export function breadcrumbJsonLd(locale: Locale, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(`/${locale}${item.path === "/" ? "" : item.path}`),
    })),
  };
}

export interface ProductJsonLdInput {
  locale: Locale;
  slug: string;
  name: string;
  description: string;
  brand: string;
  images: string[];
  /** Effective price of each variant (COP, VAT included) and whether it has stock. */
  variants: { sku: string; price: number; inStock: boolean }[];
  rating: { average: number; count: number };
  reviews: { author: string; rating: number; body: string; title: string | null; date: Date }[];
}

/**
 * schema.org Product. One Offer when every variant costs the same, an
 * AggregateOffer otherwise. aggregateRating and review only appear when real
 * reviews exist, and they are the same reviews the page shows.
 */
export function productJsonLd(input: ProductJsonLdInput) {
  const url = absoluteUrl(`/${input.locale}/p/${input.slug}`);
  const prices = input.variants.map((variant) => variant.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability = input.variants.some((variant) => variant.inStock)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const seller = { "@type": "Organization", name: ORGANIZATION_NAME };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: input.images,
    sku: input.variants[0]?.sku,
    brand: { "@type": "Brand", name: input.brand },
    url,
    offers:
      low === high
        ? {
            "@type": "Offer",
            url,
            price: low,
            priceCurrency: "COP",
            availability,
            itemCondition: "https://schema.org/NewCondition",
            seller,
          }
        : {
            "@type": "AggregateOffer",
            url,
            lowPrice: low,
            highPrice: high,
            offerCount: input.variants.length,
            priceCurrency: "COP",
            availability,
            seller,
          },
    ...(input.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(input.rating.average * 10) / 10,
            reviewCount: input.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: input.reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.author },
            datePublished: review.date.toISOString().slice(0, 10),
            ...(review.title ? { name: review.title } : {}),
            reviewBody: review.body,
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
          })),
        }
      : {}),
  };
}

export function organizationJsonLd(locale: Locale, description: string) {
  const home = absoluteUrl(`/${locale}`);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: ORGANIZATION_NAME,
      url: home,
      logo: absoluteUrl("/icon.svg"),
      description,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: ORGANIZATION_NAME,
      url: home,
      inLanguage: locale === "es" ? "es-CO" : "en",
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteUrl(`/${locale}/search`)}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}
