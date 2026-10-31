import { X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/money";
import { focusRing } from "@/components/ui/styles";
import { toQueryString, type ListingFilters } from "./listing-params";
import type { Facets } from "./queries";

interface ActiveFiltersProps {
  basePath: string;
  filters: ListingFilters;
  facets: Facets;
}

/** One removable chip per active filter; each chip is a link to the URL without it. */
export async function ActiveFilters({ basePath, filters, facets }: ActiveFiltersProps) {
  const t = await getTranslations("Filters");
  const tc = await getTranslations("Colors");
  const locale = (await getLocale()) as Locale;
  const reset = { page: 1 };

  const chips: { key: string; label: string; query: string }[] = [
    ...filters.brands.map((brand) => ({
      key: `brand-${brand}`,
      label: facets.brands.find((item) => item.slug === brand)?.name ?? brand,
      query: toQueryString(filters, {
        ...reset,
        brands: filters.brands.filter((b) => b !== brand),
      }),
    })),
    ...filters.sizes.map((size) => ({
      key: `size-${size}`,
      label: size,
      query: toQueryString(filters, { ...reset, sizes: filters.sizes.filter((s) => s !== size) }),
    })),
    ...filters.colors.map((color) => ({
      key: `color-${color}`,
      label: tc(color),
      query: toQueryString(filters, {
        ...reset,
        colors: filters.colors.filter((c) => c !== color),
      }),
    })),
  ];

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice !== undefined ? formatPrice(filters.minPrice, { locale }) : "";
    const max = filters.maxPrice !== undefined ? formatPrice(filters.maxPrice, { locale }) : "";
    chips.push({
      key: "price",
      label: t("priceRange", {
        range: min && max ? `${min} – ${max}` : min ? `≥ ${min}` : `≤ ${max}`,
      }),
      query: toQueryString(filters, { ...reset, minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (filters.minRating !== undefined) {
    chips.push({
      key: "rating",
      label: t("ratingChip", { stars: filters.minRating }),
      query: toQueryString(filters, { ...reset, minRating: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="sr-only">{t("active")}</h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={`${basePath}${chip.query}`}
              aria-label={t("remove", { label: chip.label })}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-fg/50 bg-surface px-3 text-xs font-medium text-primary-fg hover:bg-surface-raised",
                focusRing,
              )}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={`${basePath}${toQueryString(filters, {
          brands: [],
          sizes: [],
          colors: [],
          minPrice: undefined,
          maxPrice: undefined,
          minRating: undefined,
          page: 1,
        })}`}
        className={cn("rounded-sm px-2 text-xs text-muted underline hover:text-fg", focusRing)}
      >
        {t("clear")}
      </Link>
    </div>
  );
}
