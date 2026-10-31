import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PAGE_SIZE } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { focusRing } from "@/components/ui/styles";
import { ProductGridSkeleton } from "@/components/layout/page-skeleton";
import { ActiveFilters } from "@/features/catalog/active-filters";
import { FilterForm } from "@/features/catalog/filter-form";
import {
  countActiveFilters,
  parseListingParams,
  toQueryString,
  totalPages,
  type ListingFilters,
  type RawSearchParams,
} from "@/features/catalog/listing-params";
import { MobileFilters } from "@/features/catalog/mobile-filters";
import { Pagination } from "@/features/catalog/pagination";
import { ProductGrid } from "@/features/catalog/product-grid";
import { getCategoryContext, getFacets, getListing } from "@/features/catalog/queries";
import { SortSelect } from "@/features/catalog/sort-select";

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string[] }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const context = await getCategoryContext(slug);
  if (!context) return {};

  const t = await getTranslations({ locale: locale as Locale, namespace: "Listing" });
  const name = (context.child ?? context.root).name[locale as Locale];
  const path = `/c/${slug.join("/")}`;

  return {
    title: name,
    description: t("metaDescription", { category: name.toLowerCase() }),
    // Filtered and paginated variants all point to the clean category URL.
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { es: `/es${path}`, en: `/en${path}` },
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  // Resolved before anything streams, so unknown categories get a real 404.
  const context = await getCategoryContext(slug);
  if (!context) notFound();

  const [filters, facets, t, tf] = await Promise.all([
    searchParams.then(parseListingParams),
    getFacets(context.categoryIds),
    getTranslations("Listing"),
    getTranslations("Filters"),
  ]);

  const basePath = `/c/${slug.join("/")}`;
  const rootPath = `/c/${context.root.slug}`;
  const current = context.child ?? context.root;

  const breadcrumbs: BreadcrumbItem[] = context.child
    ? [{ label: context.root.name[locale], href: rootPath }, { label: context.child.name[locale] }]
    : [{ label: context.root.name[locale] }];

  const filterForm = (idPrefix: string) => (
    <FilterForm
      action={`/${locale}${basePath}`}
      basePath={basePath}
      filters={filters}
      facets={facets}
      idPrefix={idPrefix}
    />
  );

  return (
    <Container className="py-8">
      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {current.name[locale]}
      </h1>

      <nav aria-label={t("subcategories")} className="-mx-4 mb-8 overflow-x-auto px-4 pb-2">
        <ul className="flex gap-2">
          <li>
            <SubcategoryLink href={rootPath} active={!context.child}>
              {t("all")}
            </SubcategoryLink>
          </li>
          {context.root.children.map((child) => (
            <li key={child.id}>
              <SubcategoryLink
                href={`${rootPath}/${child.slug}`}
                active={context.child?.id === child.id}
              >
                {child.name[locale]}
              </SubcategoryLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-labelledby="filters-heading">
          <h2 id="filters-heading" className="sr-only">
            {tf("title")}
          </h2>
          <div className="sticky top-32">{filterForm("desktop")}</div>
        </aside>

        <section aria-label={current.name[locale]} className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MobileFilters activeCount={countActiveFilters(filters)}>
              {filterForm("mobile")}
            </MobileFilters>
            <div className="ml-auto">
              <SortSelect value={filters.sort} />
            </div>
          </div>

          <ActiveFilters basePath={basePath} filters={filters} facets={facets} />

          {/* Keyed by the query so the skeleton shows again on every filter change. */}
          <Suspense key={toQueryString(filters)} fallback={<ProductGridSkeleton />}>
            <ListingResults
              categoryIds={context.categoryIds}
              filters={filters}
              basePath={basePath}
            />
          </Suspense>
        </section>
      </div>
    </Container>
  );
}

async function ListingResults({
  categoryIds,
  filters,
  basePath,
}: {
  categoryIds: string[];
  filters: ListingFilters;
  basePath: string;
}) {
  const [{ items, total }, t] = await Promise.all([
    getListing(categoryIds, filters),
    getTranslations("Listing"),
  ]);

  return (
    <>
      <p className="text-sm text-muted" role="status">
        {t("count", { count: total })}
      </p>

      {items.length > 0 ? (
        <ProductGrid products={items} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <SearchX className="size-10 text-cyan-fg" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted">{t("emptyText")}</p>
          <Link href={basePath} className={buttonClasses({ variant: "outline" })}>
            {t("clearFilters")}
          </Link>
        </div>
      )}

      <Pagination
        currentPage={filters.page}
        pageCount={totalPages(total, PAGE_SIZE)}
        hrefForPage={(page) => `${basePath}${toQueryString(filters, { page })}`}
      />
    </>
  );
}

function SubcategoryLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-line text-muted hover:border-primary-fg hover:text-fg",
        focusRing,
      )}
    >
      {children}
    </Link>
  );
}
