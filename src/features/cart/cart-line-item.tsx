"use client";

import { ImageOff, Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { isColorKey } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import { MAX_LINE_QUANTITY } from "@/features/checkout/pricing";
import { useCart, type CartLine } from "@/stores/cart";

const stepButton = cn(
  "grid size-8 place-items-center rounded-full text-muted hover:bg-surface-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40",
  focusRing,
);

export function useVariantLabel() {
  const tc = useTranslations("Colors");
  return (line: Pick<CartLine, "size" | "color">) =>
    [line.size, line.color ? (isColorKey(line.color) ? tc(line.color) : line.color) : null]
      .filter(Boolean)
      .join(" · ");
}

/** One cart line with quantity stepper and remove button (drawer and cart page). */
export function CartLineItem({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const t = useTranslations("Cart");
  const locale = useLocale() as Locale;
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const variantLabel = useVariantLabel()(line);
  const name = line.name[locale];
  const max = Math.min(line.maxQuantity, MAX_LINE_QUANTITY);

  return (
    <li className="flex gap-4 py-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-raised">
        {line.image ? (
          <Image
            src={line.image.url}
            alt={line.image.alt[locale]}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <ImageOff className="size-6 text-muted" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{line.brand}</p>
        <Link
          href={`/p/${line.slug}?variant=${encodeURIComponent(line.sku)}`}
          onClick={onNavigate}
          className={cn("rounded-sm text-sm leading-snug font-semibold hover:underline", focusRing)}
        >
          {name}
        </Link>
        {variantLabel ? <p className="text-xs text-muted">{variantLabel}</p> : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div
            role="group"
            aria-label={t("quantityFor", { name })}
            className="flex items-center gap-1 rounded-full border border-line p-0.5"
          >
            <button
              type="button"
              className={stepButton}
              onClick={() => setQuantity(line.variantId, line.quantity - 1)}
              disabled={line.quantity <= 1}
              aria-label={t("decrease")}
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span
              className="min-w-6 text-center text-sm font-semibold tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </span>
            <button
              type="button"
              className={stepButton}
              onClick={() => setQuantity(line.variantId, line.quantity + 1)}
              disabled={line.quantity >= max}
              aria-label={t("increase")}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <Price amount={line.unitPrice * line.quantity} className="text-sm font-semibold" />
        </div>
        {line.quantity >= max ? (
          <p className="text-xs text-pink-fg">{t("maxReached", { count: max })}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => remove(line.variantId)}
        className={cn(stepButton, "self-start hover:text-pink-fg")}
        aria-label={t("remove", { name })}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Progress towards free shipping, based on the displayed subtotal. */
export function FreeShippingProgress({
  subtotal,
  threshold,
}: {
  subtotal: number;
  threshold: number;
}) {
  const t = useTranslations("Cart");
  const remaining = Math.max(threshold - subtotal, 0);
  const percent = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-cyan-fg/40 p-3 text-sm">
      <p className="text-cyan-fg">
        {remaining === 0 ? (
          t("freeShippingReached")
        ) : (
          <>
            {t("freeShippingRemainingPrefix")}{" "}
            <Price amount={remaining} className="font-semibold" />{" "}
            {t("freeShippingRemainingSuffix")}
          </>
        )}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("freeShippingProgress")}
        className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className={cn(
            "h-full rounded-full bg-cyan-fg transition-[width] motion-reduce:transition-none",
            WIDTH_CLASSES[Math.round(percent / 10)],
          )}
        />
      </div>
    </div>
  );
}

// Tailwind needs literal class names; the bar moves in 10 % steps.
const WIDTH_CLASSES = [
  "w-0",
  "w-1/10",
  "w-2/10",
  "w-3/10",
  "w-4/10",
  "w-5/10",
  "w-6/10",
  "w-7/10",
  "w-8/10",
  "w-9/10",
  "w-full",
] as const;
