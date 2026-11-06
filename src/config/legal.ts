/**
 * Version of the terms and data processing policy. Stored with each consent
 * (Profile.privacyVersion, Order.termsVersion); bump it when the texts change.
 */
export const LEGAL_VERSION = "2026-10-31";

export const LEGAL_PAGES = ["terms", "privacy", "returns"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];
