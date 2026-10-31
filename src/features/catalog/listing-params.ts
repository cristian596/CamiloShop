import { isColorKey, type ColorKey } from "@/config/catalog";

export const SORT_OPTIONS = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "rating",
  "best-selling",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const RATING_OPTIONS = [4, 3, 2] as const;

export interface ListingFilters {
  sizes: string[];
  colors: ColorKey[];
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort: SortOption;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_VALUES = 20;
const MAX_PRICE = 100_000_000;
const MAX_PAGE = 1000;
const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;
const SIZE_PATTERN = /^[\p{L}\p{N} .]{1,20}$/u;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)].slice(0, MAX_VALUES);
}

function parseInteger(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

/**
 * Parses untrusted query params into a valid filter set. Invalid values are dropped
 * instead of throwing, so a hand-edited URL still renders a sensible listing.
 */
export function parseListingParams(params: RawSearchParams): ListingFilters {
  let minPrice = parseInteger(first(params.min), 0, MAX_PRICE);
  let maxPrice = parseInteger(first(params.max), 0, MAX_PRICE);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const rating = parseInteger(first(params.rating), 1, 5);
  const sort = first(params.sort);

  return {
    sizes: unique(toArray(params.size).filter((size) => SIZE_PATTERN.test(size))),
    colors: unique(toArray(params.color).filter(isColorKey)),
    brands: unique(toArray(params.brand).filter((brand) => SLUG_PATTERN.test(brand))),
    minPrice,
    maxPrice,
    minRating: (RATING_OPTIONS as readonly number[]).includes(rating ?? -1) ? rating : undefined,
    sort: (SORT_OPTIONS as readonly string[]).includes(sort ?? "")
      ? (sort as SortOption)
      : "featured",
    page: parseInteger(first(params.page), 1, MAX_PAGE) ?? 1,
  };
}

/** Serializes filters back to a query string, omitting defaults to keep URLs clean. */
export function toQueryString(
  filters: ListingFilters,
  overrides: Partial<ListingFilters> = {},
): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  for (const brand of next.brands) params.append("brand", brand);
  for (const size of next.sizes) params.append("size", size);
  for (const color of next.colors) params.append("color", color);
  if (next.minPrice !== undefined) params.set("min", String(next.minPrice));
  if (next.maxPrice !== undefined) params.set("max", String(next.maxPrice));
  if (next.minRating !== undefined) params.set("rating", String(next.minRating));
  if (next.sort !== "featured") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function countActiveFilters(filters: ListingFilters): number {
  return (
    filters.brands.length +
    filters.sizes.length +
    filters.colors.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.minRating !== undefined ? 1 : 0)
  );
}

export type PaginationItem = number | "ellipsis";

/** Page numbers to render, e.g. [1, "ellipsis", 4, 5, 6, "ellipsis", 10]. */
export function getPaginationItems(current: number, total: number, siblings = 1): PaginationItem[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const page = Math.min(Math.max(current, 1), total);
  // first + last + current + siblings on each side + two ellipses
  const maxVisible = siblings * 2 + 5;
  if (total <= maxVisible) return Array.from({ length: total }, (_, index) => index + 1);

  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);
  const items: PaginationItem[] = [1];

  if (start > 2) items.push(start === 3 ? 2 : "ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < total - 1) items.push(end === total - 2 ? total - 1 : "ellipsis");
  items.push(total);

  return items;
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}
