import { AlertTriangle, Download } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isColorKey } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { buttonClasses } from "@/components/ui/button";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { getOrderForViewer } from "@/features/orders/queries";
import { markPaymentReviewedAction } from "@/features/admin/order-actions";
import { getAdminOrderExtras } from "@/features/admin/order-queries";
import { OrderStatusForm } from "@/features/admin/order-status-form";
import { adminTransitions } from "@/features/admin/order-transitions";
import { AdminHeader, cardClass } from "@/features/admin/ui";

interface AdminOrderPageProps {
  params: Promise<{ locale: string; number: string }>;
}

export async function generateMetadata({ params }: AdminOrderPageProps): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Orders" });
  return { title: t("detailTitle", { number: decodeURIComponent(number) }) };
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { locale: rawLocale, number: rawNumber } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const number = decodeURIComponent(rawNumber);
  const admin = await requireAdmin(`/admin/orders/${encodeURIComponent(number)}`);

  const order = await getOrderForViewer(number, { id: admin.id, isAdmin: true });
  if (!order) notFound();
  const extras = await getAdminOrderExtras(order.id);
  if (!extras) notFound();

  const [t, to, tc, format] = await Promise.all([
    getTranslations("Admin.orders"),
    getTranslations("Orders"),
    getTranslations("Colors"),
    getFormatter(),
  ]);
  const cop = (value: number) => formatPrice(value, { locale });
  const address = order.shippingAddress;
  // Money received on an order that ended up cancelled (a paid order cancelled
  // by an admin, or an approval that arrived late): it needs a manual refund.
  const lateApprovals =
    order.status === "CANCELLED"
      ? extras.payments.filter((payment) => payment.status === "APPROVED")
      : [];

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader
        title={to("detailTitle", { number: order.number })}
        description={`${format.dateTime(order.createdAt, { dateStyle: "long", timeStyle: "short" })} · ${to(`method.${order.paymentMethod}`)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <a
              href={`/api/invoice/${encodeURIComponent(order.number)}`}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" aria-hidden="true" />
              {to("downloadReceipt")}
            </a>
          </>
        }
      />

      {lateApprovals.map((payment) => (
        <section
          key={payment.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-fg/50 bg-surface p-4 text-sm"
        >
          <p className="flex items-center gap-2 text-pink-fg">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {payment.reviewedAt
              ? t("lateApprovalReviewed", { reference: payment.reference })
              : t("lateApproval", { reference: payment.reference })}
          </p>
          {payment.reviewedAt ? null : (
            <form action={markPaymentReviewedAction}>
              <input type="hidden" name="paymentId" value={payment.id} />
              <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>
                {t("markReviewed")}
              </button>
            </form>
          )}
        </section>
      ))}

      <section aria-labelledby="status-change" className={cardClass}>
        <h2 id="status-change" className="mb-4 font-semibold">
          {t("changeStatus")}
        </h2>
        <OrderStatusForm
          orderId={order.id}
          status={order.status}
          targets={adminTransitions(order.status, order.paymentMethod)}
          isCod={order.paymentMethod === "COD"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="customer" className={cardClass}>
          <h2 id="customer" className="mb-3 font-semibold">
            {t("customer")}
          </h2>
          <p>{extras.user.fullName ?? "—"}</p>
          <p className="text-sm text-muted">{extras.user.email}</p>
          {extras.user.phone ? <p className="text-sm text-muted">{extras.user.phone}</p> : null}
          <h3 className="mt-4 mb-1 text-sm font-semibold">{to("shipTo")}</h3>
          <p className="text-sm">
            {address.recipient} · {address.phone}
          </p>
          <p className="text-sm text-muted">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""} — {address.city}, {address.department}
          </p>
          {address.notes ? <p className="mt-1 text-sm text-muted">{address.notes}</p> : null}
        </section>

        <section aria-labelledby="summary" className={cardClass}>
          <h2 id="summary" className="mb-3 font-semibold">
            {to("summary")}
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-muted">{to("subtotal")}</dt>
            <dd className="text-right">{cop(order.subtotal)}</dd>
            {order.discount > 0 ? (
              <>
                <dt className="text-muted">{to("discount", { code: order.couponCode ?? "" })}</dt>
                <dd className="text-right">−{cop(order.discount)}</dd>
              </>
            ) : null}
            <dt className="text-muted">{to("shipping")}</dt>
            <dd className="text-right">
              {order.shippingCost === 0 ? to("free") : cop(order.shippingCost)}
            </dd>
            <dt className="text-muted">{to("taxBase")}</dt>
            <dd className="text-right">{cop(order.taxBase)}</dd>
            <dt className="text-muted">{to("tax")}</dt>
            <dd className="text-right">{cop(order.taxAmount)}</dd>
            <dt className="mt-2 font-semibold">{to("total")}</dt>
            <dd className="mt-2 text-right font-semibold">{cop(order.total)}</dd>
          </dl>
        </section>
      </div>

      <section aria-labelledby="items" className={cardClass}>
        <h2 id="items" className="mb-3 font-semibold">
          {to("items")}
        </h2>
        <ul className="flex flex-col divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
              <span>
                <Link
                  href={`/p/${item.slug}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.name[locale]}
                </Link>
                <span className="block text-xs text-muted">
                  {[
                    item.sku,
                    item.size,
                    item.color && isColorKey(item.color) ? tc(item.color) : item.color,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="text-right">
                {item.quantity} × {cop(item.unitPrice)}
                <span className="block font-semibold">{cop(item.lineTotal)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="payments" className={cardClass}>
          <h2 id="payments" className="mb-3 font-semibold">
            {t("payments")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {extras.payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border border-line p-3">
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-xs">{payment.reference}</span>
                  <span className="font-semibold">{t(`paymentStatus.${payment.status}`)}</span>
                </p>
                <p className="text-xs break-all text-muted">
                  {payment.provider === "COD"
                    ? to("method.COD")
                    : payment.providerTxId?.startsWith("sim_")
                      ? t("simulated")
                      : "Wompi"}
                  {payment.providerTxId ? ` · ${payment.providerTxId}` : ""} ·{" "}
                  {format.dateTime(payment.createdAt, { dateStyle: "short", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="history" className={cardClass}>
          <h2 id="history" className="mb-3 font-semibold">
            {t("history")}
          </h2>
          <ol className="flex flex-col gap-3 text-sm">
            {extras.statusHistory.map((entry) => (
              <li key={entry.id} className="border-l-2 border-primary pl-3">
                <p>
                  {entry.from ? `${to(`status.${entry.from}`)} → ` : ""}
                  <span className="font-semibold">{to(`status.${entry.to}`)}</span>
                </p>
                <p className="text-xs text-muted">
                  {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  {" · "}
                  {entry.changedBy?.email ?? t("system")}
                </p>
                {entry.note ? <p className="text-xs text-muted">“{entry.note}”</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
