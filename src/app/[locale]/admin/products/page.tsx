import { ImageOff, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage, inputClasses } from "@/components/ui/form";
import { CleanGetForm } from "@/features/catalog/clean-get-form";
import { Pagination } from "@/features/catalog/pagination";
import {
  getProductFormOptions,
  listAdminProducts,
  productFiltersSchema,
} from "@/features/admin/product-queries";
import { queryHref } from "@/features/admin/query-href";
import { AdminHeader, EmptyState, TableWrap, tdClass, thClass } from "@/features/admin/ui";

interface AdminProductsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: AdminProductsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("products") };
}

export default async function AdminProductsPage({ params, searchParams }: AdminProductsPageProps) {
  const [{ locale: rawLocale }, query] = await Promise.all([params, searchParams]);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin("/admin/products");

  const filters = productFiltersSchema.parse({
    q: typeof query.q === "string" && query.q.trim() !== "" ? query.q : undefined,
    category: query.category,
    state: query.state,
    page: query.page ?? 1,
  });
  const [t, { products, total, pageCount }, options] = await Promise.all([
    getTranslations("Admin.products"),
    listAdminProducts(filters),
    getProductFormOptions(),
  ]);
  const name = (row: { nameEs: string; nameEn: string }) =>
    locale === "en" ? row.nameEn : row.nameEs;

  return (
    <div>
      <AdminHeader
        title={t("title")}
        description={t("count", { count: total })}
        actions={
          <Link href="/admin/products/new" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden="true" />
            {t("new")}
          </Link>
        }
      />

      {query.deleted === "1" ? (
        <div className="mb-4">
          <FormMessage tone="success">{t("deleted")}</FormMessage>
        </div>
      ) : null}

      <CleanGetForm className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">{t("search")}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={t("searchPlaceholder")}
            className={`${inputClasses} pl-10`}
          />
        </label>
        <label>
          <span className="sr-only">{t("category")}</span>
          <select name="category" defaultValue={filters.category ?? ""} className={inputClasses}>
            <option value="">{t("allCategories")}</option>
            {options.roots.map((root) => (
              <optgroup key={root.id} label={name(root)}>
                {root.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {name(child)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("stateFilter")}</span>
          <select name="state" defaultValue={filters.state ?? ""} className={inputClasses}>
            <option value="">{t("allStates")}</option>
            <option value="active">{t("states.active")}</option>
            <option value="inactive">{t("states.inactive")}</option>
            <option value="lowStock">{t("states.lowStock")}</option>
          </select>
        </label>
        <button type="submit" className={buttonClasses({ variant: "outline" })}>
          {t("filter")}
        </button>
      </CleanGetForm>

      {products.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                {t("product")}
              </th>
              <th scope="col" className={thClass}>
                {t("category")}
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                {t("price")}
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                {t("stock")}
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                {t("sold")}
              </th>
              <th scope="col" className={thClass}>
                {t("state")}
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-surface-raised">
                <td className={tdClass}>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center gap-3 font-medium underline-offset-4 hover:underline"
                  >
                    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raised">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        <ImageOff className="size-4 text-muted" aria-hidden="true" />
                      )}
                    </span>
                    {name(product)}
                  </Link>
                </td>
                <td className={tdClass}>{name(product.category)}</td>
                <td className={`${tdClass} text-right whitespace-nowrap`}>
                  {formatPrice(product.price, { locale })}
                </td>
                <td className={`${tdClass} text-right`}>
                  {product.stock}
                  {product.lowStock ? (
                    <span className="block text-xs font-semibold text-pink-fg">
                      {t("lowStockVariant")}
                    </span>
                  ) : null}
                </td>
                <td className={`${tdClass} text-right`}>{product.soldCount}</td>
                <td className={tdClass}>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={product.isActive ? "cyan" : "pink"}>
                      {product.isActive ? t("states.active") : t("states.inactive")}
                    </Badge>
                    {product.isFeatured ? <Badge>{t("featured")}</Badge> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Pagination
        currentPage={filters.page}
        pageCount={pageCount}
        hrefForPage={(page) =>
          queryHref("/admin/products", {
            q: filters.q,
            category: filters.category,
            state: filters.state,
            page,
          })
        }
      />
    </div>
  );
}
