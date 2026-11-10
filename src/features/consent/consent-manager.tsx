"use client";

import { Cookie } from "lucide-react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  OPEN_CONSENT_EVENT,
  gtagBootstrap,
  serializeConsent,
  type ConsentDecision,
} from "./consent";

function storeDecision(decision: ConsentDecision) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(decision)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

/** Removes the Google Analytics cookies (_ga, _ga_XXXX) on this domain and its parent. */
function clearAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ["", `; Domain=${host}`, `; Domain=.${host.split(".").slice(-2).join(".")}`];
  for (const name of document.cookie.split("; ").map((part) => part.split("=")[0] ?? "")) {
    if (!name.startsWith("_ga")) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
  }
}

/**
 * Cookie banner + Google Analytics (Consent Mode v2, basic implementation):
 * gtag.js is not even requested until the visitor accepts analytics, so no
 * data reaches Google before consent. Without a measurement ID the store sets
 * no optional cookies, so neither the banner nor GA is rendered.
 */
export function ConsentManager({
  initialDecision,
  measurementId,
}: {
  initialDecision: ConsentDecision | null;
  measurementId: string | undefined;
}) {
  const t = useTranslations("Consent");
  const titleId = useId();
  const [decision, setDecision] = useState(initialDecision);
  const [open, setOpen] = useState(initialDecision === null);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(initialDecision === "granted");

  useEffect(() => {
    const reopen = () => {
      setAnalyticsChecked(decision === "granted");
      setShowSettings(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, [decision]);

  if (!measurementId) return null;

  const choose = (next: ConsentDecision) => {
    storeDecision(next);
    setOpen(false);
    setShowSettings(false);
    if (decision === "granted" && next === "denied") {
      // gtag.js is already running: revoke, delete its cookies and reload without it.
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      clearAnalyticsCookies();
      window.location.reload();
      return;
    }
    setDecision(next);
  };

  return (
    <>
      {decision === "granted" ? (
        <>
          <Script id="ga-bootstrap" strategy="afterInteractive">
            {gtagBootstrap(measurementId)}
          </Script>
          <Script
            id="ga-library"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          />
        </>
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-black/30 sm:inset-x-6 sm:bottom-6"
        >
          <div className="flex gap-3">
            <Cookie className="mt-0.5 size-5 shrink-0 text-cyan-fg" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="font-semibold">
                {t("title")}
              </h2>
              <p className="text-sm text-muted">
                {t.rich("text", {
                  link: (chunks) => (
                    <Link
                      href="/legal/privacy"
                      className="font-medium text-primary-fg underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>

          {showSettings ? (
            <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-4 text-sm">
              <legend className="px-1 font-semibold">{t("settingsTitle")}</legend>
              <label className="flex items-start gap-3 text-muted">
                <input type="checkbox" checked disabled className="mt-0.5 size-4 accent-primary" />
                <span>
                  <span className="block font-medium text-fg">{t("necessary")}</span>
                  {t("necessaryHint")}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={analyticsChecked}
                  onChange={(event) => setAnalyticsChecked(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="text-muted">
                  <span className="block font-medium text-fg">{t("analytics")}</span>
                  {t("analyticsHint")}
                </span>
              </label>
            </fieldset>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {showSettings ? (
              <button
                type="button"
                onClick={() => choose(analyticsChecked ? "granted" : "denied")}
                className={buttonClasses({ size: "sm" })}
              >
                {t("save")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  {t("configure")}
                </button>
                {/* Rejecting is as easy as accepting: same size, one click. */}
                <button
                  type="button"
                  onClick={() => choose("denied")}
                  className={buttonClasses({ variant: "outline", size: "sm" })}
                >
                  {t("reject")}
                </button>
                <button
                  type="button"
                  onClick={() => choose("granted")}
                  className={buttonClasses({ size: "sm" })}
                >
                  {t("accept")}
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("Consent");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {t("reopen")}
    </button>
  );
}
