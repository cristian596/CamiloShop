"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Bottom sheet that hosts the server-rendered filter form on small screens. */
export function MobileFilters({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const t = useTranslations("Filters");

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {activeCount > 0 ? t("openWithCount", { count: activeCount }) : t("title")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-line bg-canvas text-fg shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <Dialog.Title className="font-display text-lg font-semibold">{t("title")}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("close")}>
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("title")}</Dialog.Description>
          <div className="overflow-y-auto px-6 py-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
