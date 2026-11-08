import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { getPaymentGateway } from "@/lib/server-env";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { simulatePaymentAction } from "@/features/payments/actions";
import { findSimulatedPayment } from "@/features/payments/simulated-gateway";

interface SimulatedGatewayPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export async function generateMetadata({ params }: SimulatedGatewayPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "SimulatedGateway" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The built-in demo gateway: stands in for Wompi's hosted checkout. */
export default async function SimulatedGatewayPage({
  params,
  searchParams,
}: SimulatedGatewayPageProps) {
  const [{ locale: rawLocale }, { ref }] = await Promise.all([params, searchParams]);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  if (getPaymentGateway() !== "simulated") notFound();
  const user = await requireUser("/account/orders");

  const [t, format] = await Promise.all([getTranslations("SimulatedGateway"), getFormatter()]);
  const payment =
    typeof ref === "string" && ref.length <= 60
      ? await findSimulatedPayment(getDb(), ref, user.id)
      : null;

  return (
    <Container className="flex justify-center py-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <header className="flex flex-col gap-3">
          <Badge tone="cyan" className="self-start">
            {t("badge")}
          </Badge>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("intro")}</p>
        </header>

        {payment ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-raised p-4 text-sm">
              <dt className="text-muted">{t("order")}</dt>
              <dd className="text-right font-semibold">{payment.order.number}</dd>
              <dt className="text-muted">{t("reference")}</dt>
              <dd className="text-right font-mono text-xs break-all">{payment.reference}</dd>
              <dt className="text-muted">{t("method")}</dt>
              <dd className="text-right">
                {t(`methods.${payment.method === "PSE" ? "PSE" : "CARD"}`)}
              </dd>
              <dt className="text-muted">{t("expires")}</dt>
              <dd className="text-right">
                {format.dateTime(payment.order.expiresAt, { timeStyle: "short" })}
              </dd>
              <dt className="self-center font-semibold">{t("amount")}</dt>
              <dd className="text-right font-display text-xl font-bold">
                {formatPrice(payment.order.total, { locale })}
              </dd>
            </dl>

            <form action={simulatePaymentAction} className="flex flex-col gap-3">
              <input type="hidden" name="ref" value={payment.reference} />
              <button
                type="submit"
                name="outcome"
                value="APPROVED"
                className={buttonClasses({ size: "lg", className: "w-full" })}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("approve")}
              </button>
              <button
                type="submit"
                name="outcome"
                value="DECLINED"
                className={buttonClasses({ variant: "outline", size: "lg", className: "w-full" })}
              >
                <XCircle className="size-4" aria-hidden="true" />
                {t("decline")}
              </button>
              <button
                type="submit"
                name="outcome"
                value="ERROR"
                className={buttonClasses({ variant: "ghost", className: "w-full" })}
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
                {t("error")}
              </button>
            </form>

            <Link
              href={`/account/orders/${encodeURIComponent(payment.order.number)}`}
              className="text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {t("back")}
            </Link>
          </>
        ) : (
          <>
            <p role="alert" className="text-sm text-pink-fg">
              {t("unavailable")}
            </p>
            <Link href="/account/orders" className={buttonClasses({ variant: "outline" })}>
              {t("toOrders")}
            </Link>
          </>
        )}

        <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-fg" aria-hidden="true" />
          {t("disclaimer")}
        </p>
      </div>
    </Container>
  );
}
