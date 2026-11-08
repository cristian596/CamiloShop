"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Price } from "@/components/layout/price";
import { useStoreConfig } from "@/components/layout/store-config";
import { cartCount, cartSubtotal, useCart, type CartChange, type CartLine } from "@/stores/cart";
import { CartLineItem, FreeShippingProgress } from "./cart-line-item";
import { useCartSync } from "./use-cart-sync";

/** Messages for lines whose price, quantity or availability changed. */
export function CartChangeNotices({
  changes,
  previous,
}: {
  changes: CartChange[];
  previous: CartLine[];
}) {
  const t = useTranslations("Cart");
  const locale = useLocale() as Locale;
  if (changes.length === 0) return null;

  const nameOf = (variantId: string) =>
    previous.find((line) => line.variantId === variantId)?.name[locale] ?? "";

  return (
    <FormMessage tone="error">
      <p className="font-semibold">{t("changedTitle")}</p>
      <ul className="mt-1 list-disc pl-4">
        {changes.map((change) => (
          <li key={`${change.type}-${change.variantId}`}>
            {change.type === "removed"
              ? t("changeRemoved", { name: nameOf(change.variantId) })
              : change.type === "quantity"
                ? t("changeQuantity", { name: nameOf(change.variantId), count: change.after })
                : t.rich("changePrice", {
                    name: nameOf(change.variantId),
                    price: () => <Price amount={change.after} />,
                  })}
          </li>
        ))}
      </ul>
    </FormMessage>
  );
}

export function CartView() {
  const t = useTranslations("Cart");
  const lines = useCart((state) => state.lines);
  const { synced, changes, previous } = useCartSync();
  const { freeShippingThreshold } = useStoreConfig();
  const subtotal = cartSubtotal(lines);

  if (!synced) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <CartChangeNotices changes={changes} previous={previous} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <ShoppingBag className="size-10 text-primary-fg" aria-hidden="true" />
          <p className="text-muted">{t("empty")}</p>
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <CartChangeNotices changes={changes} previous={previous} />
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-5">
          {lines.map((line) => (
            <CartLineItem key={line.variantId} line={line} />
          ))}
        </ul>
      </div>
      <aside
        aria-labelledby="cart-summary-title"
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-32"
      >
        <h2 id="cart-summary-title" className="font-display text-lg font-semibold">
          {t("summary")}
        </h2>
        <FreeShippingProgress subtotal={subtotal} threshold={freeShippingThreshold} />
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("items", { count: cartCount(lines) })}</dt>
            <dd>
              <Price amount={subtotal} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("shipping")}</dt>
            <dd className="text-muted">{t("shippingAtCheckout")}</dd>
          </div>
        </dl>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="font-semibold">{t("subtotal")}</span>
          <Price amount={subtotal} className="font-display text-2xl font-bold" />
        </div>
        <p className="text-xs text-muted">{t("taxesNote")}</p>
        <Link href="/checkout" className={buttonClasses({ size: "lg", className: "w-full" })}>
          {t("checkout")}
        </Link>
        <Link href="/" className={buttonClasses({ variant: "ghost", className: "w-full" })}>
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
