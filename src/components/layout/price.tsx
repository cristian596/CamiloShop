"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { publicEnv } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";
import { usePreferences } from "@/stores/preferences";

const subscribeHydration = (onChange: () => void) =>
  usePreferences.persist.onFinishHydration(onChange);

interface PriceProps {
  /** Integer amount in COP, VAT included. */
  amount: number;
  className?: string;
}

export function Price({ amount, className }: PriceProps) {
  const locale = useLocale();
  const t = useTranslations("Price");
  const selected = usePreferences((state) => state.currency);
  // Server render and first client render always use COP to avoid hydration mismatches.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => usePreferences.persist.hasHydrated(),
    () => false,
  );
  const currency = hydrated ? selected : "COP";
  const usdRate = publicEnv.NEXT_PUBLIC_DEFAULT_USD_RATE;

  return (
    <span className={cn("tabular-nums", className)}>
      {currency === "USD" ? <span className="sr-only">{t("approx")} </span> : null}
      {currency === "USD" ? "≈ " : null}
      {formatPrice(amount, { locale, currency, usdRate })}
    </span>
  );
}
