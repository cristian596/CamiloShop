"use client";

import { AlertCircle, CreditCard, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { retryPaymentAction } from "./actions";
import type { PaymentPanel as PaymentPanelData } from "./wompi-checkout";

const POLL_INTERVAL_MS = 4_000;
const POLL_ATTEMPTS = 15;

/** Re-renders the order page while Wompi confirms a payment (about one minute). */
function PaymentPoller() {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= POLL_ATTEMPTS) window.clearInterval(timer);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}

export function PaymentPanel({
  panel,
  number,
  autoOpen,
  polling,
}: {
  panel: PaymentPanelData;
  number: string;
  /** Open Wompi right away (just after placing the order or creating a new attempt). */
  autoOpen: boolean;
  /** The customer just came back from Wompi: keep checking for the result. */
  polling: boolean;
}) {
  const t = useTranslations("Payments");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!autoOpen || panel.kind !== "pay") return;
    // Drop ?pay=1 first so the back button does not reopen Wompi in a loop.
    const url = new URL(window.location.href);
    url.searchParams.delete("pay");
    window.history.replaceState(null, "", url);
    formRef.current?.submit();
  }, [autoOpen, panel.kind]);

  return (
    <section
      aria-labelledby="payment-title"
      className="flex flex-col gap-4 rounded-2xl border border-primary/50 bg-surface p-5 sm:p-6"
    >
      <h2 id="payment-title" className="font-display text-lg font-semibold">
        {t("title")}
      </h2>

      {panel.kind === "pay" ? (
        <>
          <p className="text-sm text-muted">
            {t(autoOpen ? "redirecting" : "payHint", { gateway: panel.gateway })}
          </p>
          <form ref={formRef} action={panel.form.action} method="GET">
            {panel.form.fields.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className={buttonClasses({ size: "lg", className: "w-full" })}>
              <CreditCard className="size-4" aria-hidden="true" />
              {t("payNow")}
            </button>
          </form>
          <p className="text-xs text-muted">
            {t(panel.gateway === "simulated" ? "simulatedNote" : "sandboxNote")}
          </p>
          {polling ? <PaymentPoller /> : null}
        </>
      ) : null}

      {panel.kind === "processing" ? (
        <p role="status" className="flex items-center gap-2 text-sm text-cyan-fg">
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          {t("processing")}
          <PaymentPoller />
        </p>
      ) : null}

      {panel.kind === "retry" ? (
        <>
          <FormMessage tone="error">
            <p className="font-semibold">
              {t(`failed.${panel.lastStatus === "DECLINED" ? "DECLINED" : "OTHER"}`)}
            </p>
            {panel.message ? <p className="mt-1 text-xs">{panel.message}</p> : null}
          </FormMessage>
          <form action={retryPaymentAction}>
            <input type="hidden" name="number" value={number} />
            <button type="submit" className={buttonClasses({ size: "lg", className: "w-full" })}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("payAgain")}
            </button>
          </form>
          <p className="text-xs text-muted">{t("retryHint")}</p>
        </>
      ) : null}

      {panel.kind === "expired" ? (
        <p className="flex items-center gap-2 text-sm text-pink-fg">
          <AlertCircle className="size-4" aria-hidden="true" />
          {t("expired")}
        </p>
      ) : null}
    </section>
  );
}
