import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { buttonClasses } from "@/components/ui/button";
import { DASHBOARD_DAYS, getDashboardData } from "@/features/admin/dashboard";
import { SalesChart, StatusChart } from "@/features/admin/dashboard-charts";
import { markPaymentReviewedAction } from "@/features/admin/order-actions";
import { AdminHeader, StatCard, cardClass } from "@/features/admin/ui";

interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("dashboard") };
}

export default async function AdminDashboardPage({ params }: AdminPageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin("/admin");

  const [t, data] = await Promise.all([getTranslations("Admin.dashboard"), getDashboardData()]);
  const cop = (value: number) => formatPrice(value, { locale });

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader title={t("title")} description={t("window", { days: DASHBOARD_DAYS })} />

      {data.paymentAlerts.length > 0 ? (
        <section
          aria-labelledby="payment-alerts"
          className="flex flex-col gap-3 rounded-2xl border border-pink-fg/50 bg-surface p-5"
        >
          <h2 id="payment-alerts" className="flex items-center gap-2 font-semibold text-pink-fg">
            <AlertTriangle className="size-5" aria-hidden="true" />
            {t("alertsTitle")}
          </h2>
          <p className="text-sm text-muted">{t("alertsHint")}</p>
          <ul className="flex flex-col gap-2">
            {data.paymentAlerts.map((alert) => (
              <li
                key={alert.paymentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm"
              >
                <span>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(alert.orderNumber)}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {alert.orderNumber}
                  </Link>{" "}
                  · <span className="font-mono text-xs">{alert.reference}</span> ·{" "}
                  {cop(alert.amount)}
                </span>
                <form action={markPaymentReviewedAction}>
                  <input type="hidden" name="paymentId" value={alert.paymentId} />
                  <button
                    type="submit"
                    className={buttonClasses({ variant: "outline", size: "sm" })}
                  >
                    {t("markReviewed")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("revenue")} value={cop(data.revenue)} hint={t("revenueHint")} />
        <StatCard label={t("paidOrders")} value={data.paidOrders} tone="cyan" />
        <StatCard label={t("averageTicket")} value={cop(data.averageTicket)} tone="cyan" />
        <StatCard
          label={t("pendingWork")}
          value={data.codToConfirm + data.toShip}
          hint={t("pendingWorkHint", { cod: data.codToConfirm, ship: data.toShip })}
          tone="pink"
        />
      </div>

      <section aria-labelledby="sales-title" className={cardClass}>
        <h2 id="sales-title" className="mb-4 font-semibold">
          {t("salesTitle")}
        </h2>
        <SalesChart daily={data.daily} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="status-title" className={cardClass}>
          <h2 id="status-title" className="mb-4 font-semibold">
            {t("statusTitle")}
          </h2>
          <StatusChart byStatus={data.byStatus} />
        </section>

        <section aria-labelledby="top-title" className={cardClass}>
          <h2 id="top-title" className="mb-4 font-semibold">
            {t("topTitle")}
          </h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-muted">{t("noSales")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.topProducts.map((product, index) => {
                const max = data.topProducts[0]?.units ?? 1;
                return (
                  <li key={product.productId} className="flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <Link
                        href={`/admin/products/${product.productId}`}
                        className="truncate underline-offset-4 hover:underline"
                      >
                        {index + 1}. {locale === "en" ? product.nameEn : product.nameEs}
                      </Link>
                      <span className="shrink-0 font-semibold">
                        {t("units", { count: product.units })}
                      </span>
                    </div>
                    {/* Share of the best seller, styled with Tailwind variants only. */}
                    <progress
                      value={product.units}
                      max={max}
                      aria-hidden="true"
                      className="h-2 w-full appearance-none overflow-hidden rounded-full bg-surface-raised [&::-moz-progress-bar]:bg-pink [&::-webkit-progress-bar]:bg-surface-raised [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-pink"
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
