import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { CleanGetForm } from "@/features/catalog/clean-get-form";
import { Pagination } from "@/features/catalog/pagination";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { ORDER_STATUSES } from "@/features/orders/status";
import { listAdminOrders, orderFiltersSchema } from "@/features/admin/order-queries";
import { queryHref } from "@/features/admin/query-href";
import { AdminHeader, EmptyState, TableWrap, tdClass, thClass } from "@/features/admin/ui";

interface AdminOrdersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: AdminOrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("orders") };
}

export default async function AdminOrdersPage({ params, searchParams }: AdminOrdersPageProps) {
  const [{ locale: rawLocale }, query] = await Promise.all([params, searchParams]);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin("/admin/orders");

  const filters = orderFiltersSchema.parse({
    status: query.status,
    method: query.method,
    q: typeof query.q === "string" && query.q.trim() !== "" ? query.q : undefined,
    page: query.page ?? 1,
  });
  const [t, to, format, { orders, total, pageCount }] = await Promise.all([
    getTranslations("Admin.orders"),
    getTranslations("Orders"),
    getFormatter(),
    listAdminOrders(filters),
  ]);

  return (
    <div>
      <AdminHeader title={t("title")} description={t("count", { count: total })} />

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
          <span className="sr-only">{t("statusFilter")}</span>
          <select name="status" defaultValue={filters.status ?? ""} className={inputClasses}>
            <option value="">{t("allStatuses")}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {to(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("methodFilter")}</span>
          <select name="method" defaultValue={filters.method ?? ""} className={inputClasses}>
            <option value="">{t("allMethods")}</option>
            {(["CARD", "PSE", "COD"] as const).map((method) => (
              <option key={method} value={method}>
                {to(`method.${method}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClasses({ variant: "outline" })}>
          {t("filter")}
        </button>
      </CleanGetForm>

      {orders.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                {t("number")}
              </th>
              <th scope="col" className={thClass}>
                {t("customer")}
              </th>
              <th scope="col" className={thClass}>
                {t("date")}
              </th>
              <th scope="col" className={thClass}>
                {t("method")}
              </th>
              <th scope="col" className={thClass}>
                {t("status")}
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-surface-raised">
                <td className={tdClass}>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(order.number)}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {order.number}
                  </Link>
                </td>
                <td className={tdClass}>
                  <span className="block">{order.user.fullName ?? "—"}</span>
                  <span className="block text-xs text-muted">{order.user.email}</span>
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {format.dateTime(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className={tdClass}>{to(`method.${order.paymentMethod}`)}</td>
                <td className={tdClass}>
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className={`${tdClass} text-right font-semibold whitespace-nowrap`}>
                  {formatPrice(order.total, { locale })}
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
          queryHref("/admin/orders", {
            q: filters.q,
            status: filters.status,
            method: filters.method,
            page,
          })
        }
      />
    </div>
  );
}
