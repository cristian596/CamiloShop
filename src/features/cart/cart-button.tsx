"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ShoppingBag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { Price } from "@/components/layout/price";
import { useStoreConfig } from "@/components/layout/store-config";
import { cartCount, cartSubtotal, useCart, useCartDrawer, useCartHydrated } from "@/stores/cart";
import { CartLineItem, FreeShippingProgress } from "./cart-line-item";

/** Header cart button with item count; opens the cart drawer. */
export function CartButton() {
  const t = useTranslations("Cart");
  const hydrated = useCartHydrated();
  const lines = useCart((state) => state.lines);
  const { open, setOpen } = useCartDrawer();
  const { freeShippingThreshold } = useStoreConfig();
  const count = hydrated ? cartCount(lines) : 0;
  const subtotal = cartSubtotal(lines);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={count > 0 ? t("openWithCount", { count }) : t("open")}
          className="relative"
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[92%] max-w-md flex-col border-l border-line bg-canvas text-fg shadow-2xl">
          <div className="flex items-center justify-between border-b border-line p-5">
            <Dialog.Title className="font-display text-lg font-semibold">
              {t("title")} {count > 0 ? <span className="text-muted">({count})</span> : null}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("close")}>
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("drawerDescription")}</Dialog.Description>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <ShoppingBag className="size-10 text-primary-fg" aria-hidden="true" />
              <p className="text-muted">{t("empty")}</p>
              <Dialog.Close asChild>
                <Link href="/" className={buttonClasses({ variant: "outline" })}>
                  {t("continueShopping")}
                </Link>
              </Dialog.Close>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5">
                <ul className="divide-y divide-line">
                  {lines.map((line) => (
                    <CartLineItem key={line.variantId} line={line} onNavigate={close} />
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4 border-t border-line p-5">
                <FreeShippingProgress subtotal={subtotal} threshold={freeShippingThreshold} />
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("subtotal")}</span>
                  <Price amount={subtotal} className="font-display text-xl font-bold" />
                </div>
                <p className="text-xs text-muted">{t("taxesNote")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/cart"
                    onClick={close}
                    className={buttonClasses({ variant: "outline" })}
                  >
                    {t("viewCart")}
                  </Link>
                  <Link href="/checkout" onClick={close} className={buttonClasses()}>
                    {t("checkout")}
                  </Link>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
