export type Currency = "COP" | "USD";

const NUMBER_LOCALES = { es: "es-CO", en: "en-US" } as const;

type AppLocale = keyof typeof NUMBER_LOCALES;

/** Converts an integer COP amount to USD, rounded to cents. Display only. */
export function copToUsd(amountCop: number, usdRate: number): number {
  if (!Number.isFinite(usdRate) || usdRate <= 0) {
    throw new RangeError("usdRate must be a positive number");
  }
  return Math.round((amountCop / usdRate) * 100) / 100;
}

/** Formats an integer COP amount in the requested display currency. */
export function formatPrice(
  amountCop: number,
  options: { locale: AppLocale; currency?: Currency; usdRate?: number },
): string {
  const { locale, currency = "COP", usdRate } = options;
  const numberLocale = NUMBER_LOCALES[locale];

  if (currency === "USD") {
    if (usdRate === undefined) throw new RangeError("usdRate is required for USD");
    return new Intl.NumberFormat(numberLocale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(copToUsd(amountCop, usdRate));
  }

  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCop);
}

/** Whole-number discount percentage between a previous and a current price. */
export function discountPercent(compareAtPrice: number, price: number): number {
  if (compareAtPrice <= 0 || price >= compareAtPrice) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
