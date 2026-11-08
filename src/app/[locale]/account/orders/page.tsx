import { ChevronRight, Package } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { getUserOrders } from "@/features/orders/queries";

interface OrdersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("orders") };
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/account/orders");
  const [t, to, format, orders] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Orders"),
    getFormatter(),
    getUserOrders(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("orders")}</h1>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <Package className="size-8 text-cyan-fg" aria-hidden="true" />
          <p className="max-w-sm text-muted">{to("empty")}</p>
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            {t("exploreProducts")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${encodeURIComponent(order.number)}`}
                className={cn(
                  "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-primary-fg/50",
                  focusRing,
                )}
              >
                <span className="flex min-w-40 flex-col">
                  <span className="font-mono text-sm font-semibold">{order.number}</span>
                  <span className="text-xs text-muted">
                    {format.dateTime(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </span>
                <OrderStatusBadge status={order.status} />
                <span className="text-sm text-muted">
                  {to("itemCount", {
                    count: order.items.reduce((sum, item) => sum + item.quantity, 0),
                  })}{" "}
                  · {to(`method.${order.paymentMethod}`)}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <Price amount={order.total} className="font-semibold" />
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
