/**
 * Cookie consent, stored in a first-party cookie. The version is part of the
 * value: bumping CONSENT_VERSION (e.g. when a new kind of cookie is added)
 * makes every visitor choose again.
 */

export const CONSENT_COOKIE = "cs_consent";
export const CONSENT_VERSION = "1";
/** About six months, then the banner asks again. */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
/** Fired by the footer link to reopen the preferences. */
export const OPEN_CONSENT_EVENT = "camiloshop:open-consent";

export type ConsentDecision = "granted" | "denied";

export function serializeConsent(decision: ConsentDecision): string {
  return `v${CONSENT_VERSION}.${decision}`;
}

/** The stored decision, or null when there is none (or it is from an old version). */
export function parseConsent(value: string | undefined | null): ConsentDecision | null {
  const match = /^v(\d+)\.(granted|denied)$/.exec(value ?? "");
  if (!match || match[1] !== CONSENT_VERSION) return null;
  return match[2] as ConsentDecision;
}

/**
 * The inline gtag bootstrap, run only after the visitor accepted analytics.
 * Consent Mode v2 defaults everything to denied and then grants analytics
 * storage only (no advertising signals are ever granted).
 */
export function gtagBootstrap(measurementId: string): string {
  if (!/^G-[A-Z0-9]{4,20}$/.test(measurementId)) throw new Error("Invalid GA4 measurement ID");
  return [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag = gtag;",
    "gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });",
    "gtag('consent', 'update', { analytics_storage: 'granted' });",
    "gtag('js', new Date());",
    `gtag('config', '${measurementId}');`,
  ].join("\n");
}
