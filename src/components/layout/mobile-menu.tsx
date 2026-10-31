"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/styles";
import { CurrencySwitcher } from "./currency-switcher";
import { LocaleSwitcher } from "./locale-switcher";

export function MobileMenu() {
  const t = useTranslations("Header");
  const tc = useTranslations("Categories");
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("openMenu")} className="lg:hidden">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col gap-6 overflow-y-auto border-r border-line bg-canvas p-6 text-fg shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-semibold">
              {t("menuTitle")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("closeMenu")}>
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("mainNav")}</Dialog.Description>
          <nav aria-label={t("mainNav")}>
            <ul className="flex flex-col gap-6">
              {ROOT_CATEGORIES.map((root) => (
                <li key={root.key}>
                  <Link
                    href={categoryHref(root.slug)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md font-display font-semibold text-primary-fg",
                      focusRing,
                    )}
                  >
                    {tc(root.key)}
                  </Link>
                  <ul className="mt-3 flex flex-col gap-2 border-l border-line pl-4">
                    {root.children.map((child) => (
                      <li key={child.key}>
                        <Link
                          href={categoryHref(root.slug, child.slug)}
                          onClick={() => setOpen(false)}
                          className={cn("rounded-md text-sm text-muted hover:text-fg", focusRing)}
                        >
                          {tc(child.key)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto flex gap-3 border-t border-line pt-6">
            <LocaleSwitcher />
            <CurrencySwitcher />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
