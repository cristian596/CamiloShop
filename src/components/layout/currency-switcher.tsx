"use client";

import { useTranslations } from "next-intl";
import type { Currency } from "@/lib/money";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { usePreferences } from "@/stores/preferences";

const CURRENCIES: Currency[] = ["COP", "USD"];

export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations("Preferences");
  const currency = usePreferences((state) => state.currency);
  const setCurrency = usePreferences((state) => state.setCurrency);

  return (
    <label className={cn("flex items-center gap-2 text-sm", className)} title={t("currencyNote")}>
      <span className="sr-only">{t("currency")}</span>
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value as Currency)}
        aria-describedby="currency-note"
        className={cn(
          "h-9 rounded-full border border-line bg-surface px-3 text-sm text-fg",
          focusRing,
        )}
      >
        {CURRENCIES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span id="currency-note" className="sr-only">
        {t("currencyNote")}
      </span>
    </label>
  );
}
