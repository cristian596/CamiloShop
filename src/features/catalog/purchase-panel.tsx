"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { COLOR_SWATCH_CLASSES, isColorKey } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/layout/price";
import {
  LOW_STOCK_THRESHOLD,
  applySelection,
  findVariant,
  getVariantAxes,
  isOptionAvailable,
  type VariantOption,
  type VariantSelection,
} from "./variants";

interface PurchasePanelProps {
  price: number;
  compareAtPrice: number | null;
  variants: VariantOption[];
  /** Resolved on the server from ?variant=<sku> or the first in-stock variant. */
  initialSelection: VariantSelection;
}

const chipBase =
  "inline-flex h-10 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus";

export function PurchasePanel({
  price,
  compareAtPrice,
  variants,
  initialSelection,
}: PurchasePanelProps) {
  const t = useTranslations("Product");
  const tc = useTranslations("Colors");
  const groupId = useId();
  const [selection, setSelection] = useState(initialSelection);
  const { sizes, colors } = getVariantAxes(variants);
  const variant = findVariant(variants, selection);

  const unitPrice = variant?.priceOverride ?? price;
  const previousPrice = compareAtPrice && compareAtPrice > unitPrice ? compareAtPrice : null;
  const discount = previousPrice ? discountPercent(previousPrice, unitPrice) : 0;
  const stock = variant?.stock ?? 0;

  const colorLabel = (color: string) => (isColorKey(color) ? tc(color) : color);

  function choose(axis: "size" | "color", value: string) {
    const next = applySelection(variants, selection, axis, value);
    setSelection(next);
    const chosen = findVariant(variants, next);
    if (chosen) {
      // Shareable URL for the chosen variant without a server round trip.
      const url = new URL(window.location.href);
      url.searchParams.set("variant", chosen.sku);
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="sr-only">{t("currentPrice")}</span>
          <Price amount={unitPrice} className="font-display text-3xl font-bold" />
          {previousPrice ? (
            <>
              <span className="sr-only">{t("previousPrice")}</span>
              <s>
                <Price amount={previousPrice} className="text-lg text-muted" />
              </s>
              <Badge tone="pink">{t("discount", { percent: discount })}</Badge>
            </>
          ) : null}
        </div>
        <p className="text-xs text-muted">{t("vatIncluded")}</p>
      </div>

      {sizes.length > 0 ? (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">
            {t("selected", { label: t("size"), value: selection.size ?? "—" })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = isOptionAvailable(variants, "size", size, selection);
              return (
                <label key={size}>
                  <input
                    type="radio"
                    name={`${groupId}-size`}
                    value={size}
                    checked={selection.size === size}
                    onChange={() => choose("size", size)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      chipBase,
                      "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary",
                      available
                        ? "border-line hover:border-primary-fg"
                        : "border-dashed border-line text-muted line-through",
                    )}
                  >
                    {size}
                    {!available ? (
                      <span className="sr-only">{t("unavailable", { value: "" })}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {colors.length > 0 ? (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">
            {t("selected", {
              label: t("color"),
              value: selection.color ? colorLabel(selection.color) : "—",
            })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = isOptionAvailable(variants, "color", color, selection);
              return (
                <label key={color}>
                  <input
                    type="radio"
                    name={`${groupId}-color`}
                    value={color}
                    checked={selection.color === color}
                    onChange={() => choose("color", color)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      chipBase,
                      "pl-2 peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary",
                      available
                        ? "border-line hover:border-primary-fg"
                        : "border-dashed border-line text-muted line-through",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-6 rounded-full border border-line",
                        isColorKey(color) && COLOR_SWATCH_CLASSES[color],
                        !available && "opacity-40",
                      )}
                    />
                    {colorLabel(color)}
                    {!available ? (
                      <span className="sr-only">{t("unavailable", { value: "" })}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <p
        role="status"
        className={cn(
          "text-sm font-medium",
          stock <= LOW_STOCK_THRESHOLD ? "text-pink-fg" : "text-cyan-fg",
        )}
      >
        {stock === 0
          ? t("outOfStock")
          : stock <= LOW_STOCK_THRESHOLD
            ? t("lowStock", { count: stock })
            : t("inStock")}
      </p>

      <div className="flex flex-col gap-2">
        {/* The cart arrives with checkout; the button is shown disabled until then. */}
        <Button
          size="lg"
          disabled
          aria-describedby={`${groupId}-cart-note`}
          className="w-full sm:w-auto"
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          {t("addToCart")}
        </Button>
        <p id={`${groupId}-cart-note`} className="text-xs text-muted">
          {stock === 0 ? t("outOfStock") : t("cartComingSoon")}
        </p>
      </div>

      {variant ? (
        <p className="text-xs text-muted">
          {t("sku")}: <span className="font-mono">{variant.sku}</span>
        </p>
      ) : null}
    </div>
  );
}
