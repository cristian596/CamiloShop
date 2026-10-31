import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PAGE_SIZE } from "@/config/catalog";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ProductGridSkeleton } from "@/components/layout/page-skeleton";
import {
  parseListingParams,
  totalPages,
  type RawSearchParams,
} from "@/features/catalog/listing-params";
import { Pagination } from "@/features/catalog/pagination";
import { ProductGrid } from "@/features/catalog/product-grid";
import { searchProducts } from "@/features/catalog/queries";
import { normalizeSearchQuery } from "@/features/catalog/search-query";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale: locale as Locale, namespace: "Search" });
  const query = normalizeSearchQuery(raw.q);

  return {
    title: query ? t("title", { query }) : t("titleEmpty"),
    // Search result pages are thin, near-infinite duplicates: keep them out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Search");
  const query = normalizeSearchQuery(raw.q);
  const { page } = parseListingParams(raw);

  return (
    <Container className="py-8">
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {query ? t("title", { query }) : t("titleEmpty")}
      </h1>

      {query ? (
        <Suspense key={`${query}-${page}`} fallback={<ProductGridSkeleton />}>
          <SearchResults query={query} page={page} />
        </Suspense>
      ) : (
        <p className="text-muted">{t("hint")}</p>
      )}
    </Container>
  );
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  const [{ items, total }, t, tc] = await Promise.all([
    searchProducts(query, page),
    getTranslations("Search"),
    getTranslations("Categories"),
  ]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <SearchX className="size-10 text-cyan-fg" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold">{t("emptyTitle", { query })}</h2>
        <p className="max-w-md text-sm text-muted">{t("emptyText")}</p>
        <nav aria-label={t("browse")} className="mt-2">
          <ul className="flex flex-wrap justify-center gap-2">
            {ROOT_CATEGORIES.map((root) => (
              <li key={root.key}>
                <Link
                  href={categoryHref(root.slug)}
                  className={buttonClasses({ variant: "outline", size: "sm" })}
                >
                  {tc(root.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted" role="status">
        {t("count", { count: total })}
      </p>
      <ProductGrid products={items} />
      <Pagination
        currentPage={page}
        pageCount={totalPages(total, PAGE_SIZE)}
        hrefForPage={(target) =>
          `/search?q=${encodeURIComponent(query)}${target > 1 ? `&page=${target}` : ""}`
        }
      />
    </div>
  );
}
