"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { SORT_OPTIONS, type SortOption } from "./listing-params";

export function SortSelect({ value }: { value: SortOption }) {
  const t = useTranslations("Sort");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(next: SortOption) {
    const params = new URLSearchParams(searchParams);
    if (next === "featured") params.delete("sort");
    else params.set("sort", next);
    // A new order starts again from the first page.
    params.delete("page");
    const query = params.toString();
    startTransition(() =>
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t("label")}</span>
      <select
        value={value}
        disabled={isPending}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className={cn(
          "h-10 rounded-full border border-line bg-surface px-3 text-sm text-fg",
          focusRing,
        )}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
