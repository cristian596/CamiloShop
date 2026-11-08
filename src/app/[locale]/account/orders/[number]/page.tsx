import { CheckCircle2, Circle, Download, ImageOff, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isColorKey } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import { cancelMyOrderAction } from "@/features/orders/actions";
import { CancelOrderButton } from "@/features/orders/cancel-order-button";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { getOrderForViewer, isAdminUser } from "@/features/orders/queries";
import { ORDER_PROGRESS, canCustomerCancel } from "@/features/orders/status";
import { PaymentPanel } from "@/features/payments/payment-panel";
import { getPaymentPanel, syncReturnedTransaction } from "@/features/payments/wompi-checkout";

interface OrderPageProps {
  params: Promise<{ locale: string; number: string }>;
  searchParams: Promise<{ placed?: string; pay?: string; id?: string; retry?: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Orders" });
  return { title: t("detailTitle", { number: decodeURIComponent(number) }) };
}

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const [{ locale: rawLocale, number: rawNumber }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const number = decodeURIComponent(rawNumber);
  const user = await requireUser(`/account/orders/${encodeURIComponent(number)}`);

  const viewer = { id: user.id, isAdmin: await isAdminUser(user.id) };
  let order = await getOrderForViewer(number, viewer);
  // Someone else's order looks exactly like a missing one.
  if (!order) notFound();

  // Back from Wompi (?id=<transaction>): confirm with the Wompi API, then re-read.
  if (query.id && order.status === "PENDING" && order.paymentMethod !== "COD") {
    await syncReturnedTransaction(order.id, query.id);
    order = (await getOrderForViewer(number, viewer)) ?? order;
  }
  const paymentPanel = order.userId === user.id ? await getPaymentPanel(order, locale) : null;

  const [t, tc, format] = await Promise.all([
    getTranslations("Orders"),
    getTranslations("Colors"),
    getFormatter(),
  ]);
  const address = order.shippingAddress;
  const reached = new Set(order.statusHistory.map((entry) => entry.to));
  const dateOf = (status: string) =>
    order.statusHistory.find((entry) => entry.to === status)?.createdAt ?? null;

  return (
    <div className="flex flex-col gap-6">
      {query.placed && order.status === "PENDING" ? (
        <FormMessage tone="success">
          <p className="font-semibold">{t("placedTitle")}</p>
          <p className="mt-1">
            {order.paymentMethod === "COD" ? t("placedCod") : t("placedOnline")}
          </p>
        </FormMessage>
      ) : null}

      {query.retry === "limited" ? (
        <FormMessage tone="error">{t("retryLimited")}</FormMessage>
      ) : null}
      {query.id && order.status === "PAID" ? (
        <FormMessage tone="success">{t("paidNow")}</FormMessage>
      ) : null}

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("detailTitle", { number: order.number })}
        </h1>
        <OrderStatusBadge status={order.status} />
        <p className="w-full text-sm text-muted">
          {format.dateTime(order.createdAt, { dateStyle: "long", timeStyle: "short" })} ·{" "}
          {t(`method.${order.paymentMethod}`)}
        </p>
      </header>

      {paymentPanel ? (
        <PaymentPanel
          panel={paymentPanel}
          number={order.number}
          autoOpen={query.pay === "1"}
          polling={Boolean(query.id)}
        />
      ) : null}

      {/* Progress */}
      <section aria-labelledby="order-progress" className={cardClass}>
        <h2 id="order-progress" className="sr-only">
          {t("progress")}
        </h2>
        {order.status === "CANCELLED" ? (
          <p className="flex items-center gap-2 text-pink-fg">
            <XCircle className="size-5" aria-hidden="true" />
            {t("cancelledOn", {
              date: format.dateTime(order.cancelledAt ?? order.createdAt, { dateStyle: "medium" }),
            })}
          </p>
        ) : (
          <ol className="grid gap-4 sm:grid-cols-4">
            {ORDER_PROGRESS.map((status) => {
              const done = reached.has(status);
              const date = dateOf(status);
              return (
                <li key={status} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  {done ? (
                    <CheckCircle2 className="size-6 text-cyan-fg" aria-hidden="true" />
                  ) : (
                    <Circle className="size-6 text-muted" aria-hidden="true" />
                  )}
                  <span className="flex flex-col">
                    <span className={cn("text-sm font-medium", !done && "text-muted")}>
                      {t(`status.${status}`)}
                      <span className="sr-only">
                        {done ? ` — ${t("done")}` : ` — ${t("notYet")}`}
                      </span>
                    </span>
                    {date ? (
                      <span className="text-xs text-muted">
                        {format.dateTime(date, { dateStyle: "medium" })}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {order.status === "PENDING" && order.expiresAt ? (
          <p className="mt-4 text-sm text-muted">
            {order.paymentMethod === "COD"
              ? t("codPendingNote", {
                  date: format.dateTime(order.expiresAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : t("expiresNote", {
                  date: format.dateTime(order.expiresAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
          </p>
        ) : null}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* Items */}
        <section aria-labelledby="order-items" className={cardClass}>
          <h2 id="order-items" className="mb-2 font-display text-lg font-semibold">
            {t("items")}
          </h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => {
              const variant = [
                item.size,
                item.color ? (isColorKey(item.color) ? tc(item.color) : item.color) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-raised">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff className="m-auto size-5 text-muted" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                    <Link
                      href={`/p/${item.slug}?variant=${encodeURIComponent(item.sku)}`}
                      className={cn("rounded-sm font-semibold hover:underline", focusRing)}
                    >
                      {item.name[locale]}
                    </Link>
                    {variant ? <span className="text-xs text-muted">{variant}</span> : null}
                    <span className="text-xs text-muted">
                      {item.quantity} × <Price amount={item.unitPrice} />
                    </span>
                  </div>
                  <Price amount={item.lineTotal} className="text-sm font-semibold" />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col gap-6">
          {/* Totals */}
          <section aria-labelledby="order-totals" className={cardClass}>
            <h2 id="order-totals" className="mb-4 font-display text-lg font-semibold">
              {t("summary")}
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("subtotal")}</dt>
                <dd>
                  <Price amount={order.subtotal} />
                </dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between text-pink-fg">
                  <dt>{t("discount", { code: order.couponCode ?? "" })}</dt>
                  <dd>
                    -<Price amount={order.discount} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted">{t("shipping")}</dt>
                <dd>
                  {order.shippingCost === 0 ? t("free") : <Price amount={order.shippingCost} />}
                </dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3">
                <dt className="text-muted">{t("taxBase")}</dt>
                <dd>
                  <Price amount={order.taxBase} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("tax")}</dt>
                <dd>
                  <Price amount={order.taxAmount} />
                </dd>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                <dt className="font-semibold">{t("total")}</dt>
                <dd>
                  <Price amount={order.total} className="font-display text-xl font-bold" />
                </dd>
              </div>
            </dl>
            <a
              href={`/api/invoice/${encodeURIComponent(order.number)}?locale=${locale}`}
              className={buttonClasses({ variant: "outline", className: "mt-5 w-full" })}
            >
              <Download className="size-4" aria-hidden="true" />
              {t("downloadReceipt")}
            </a>
            <p className="mt-2 text-xs text-muted">{t("receiptNote")}</p>
          </section>

          {/* Address */}
          <section aria-labelledby="order-address" className={cardClass}>
            <h2 id="order-address" className="mb-3 font-display text-lg font-semibold">
              {t("shipTo")}
            </h2>
            <address className="text-sm leading-relaxed text-muted not-italic">
              {address.recipient} · {address.phone}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.department}
              {address.notes ? (
                <>
                  <br />
                  {address.notes}
                </>
              ) : null}
            </address>
          </section>

          {order.userId === user.id && canCustomerCancel(order.status) ? (
            <form action={cancelMyOrderAction}>
              <input type="hidden" name="number" value={order.number} />
              <CancelOrderButton />
            </form>
          ) : null}
        </div>
      </div>

      <Link
        href="/account/orders"
        className={cn("self-start text-sm text-primary-fg hover:underline", focusRing)}
      >
        {t("backToOrders")}
      </Link>
    </div>
  );
}
