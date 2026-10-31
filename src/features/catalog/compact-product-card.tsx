"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import type { RecentlyViewedItem } from "@/stores/recently-viewed";

/** Small client-side card for lists built in the browser (e.g. recently viewed). */
export function CompactProductCard({ product }: { product: RecentlyViewedItem }) {
  const locale = useLocale() as Locale;

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-fg/50">
      <div className="relative aspect-square bg-surface-raised">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt[locale]}
            fill
            sizes="(min-width: 1024px) 16vw, 40vw"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <ImageOff className="size-8 text-muted" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {product.brand}
        </p>
        <h3 className="text-sm leading-snug font-semibold">
          <Link
            href={`/p/${product.slug}`}
            className={cn("rounded-sm after:absolute after:inset-0", focusRing)}
          >
            {product.name[locale]}
          </Link>
        </h3>
        <Price amount={product.price} className="text-sm font-semibold" />
      </div>
    </article>
  );
}
