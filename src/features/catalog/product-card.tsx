import { ImageOff } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { NEW_PRODUCT_DAYS } from "@/config/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating-stars";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import type { ProductSummary } from "./queries";

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProductCardProps {
  product: ProductSummary;
  /** Eager-load images that are likely above the fold. */
  priority?: boolean;
}

export async function ProductCard({ product, priority = false }: ProductCardProps) {
  const t = await getTranslations("Product");
  const locale = (await getLocale()) as Locale;
  const name = product.name[locale];
  const discount = product.compareAtPrice
    ? discountPercent(product.compareAtPrice, product.price)
    : 0;
  // eslint-disable-next-line react-hooks/purity -- server component: rendered once per request
  const isNew = Date.now() - product.createdAt.getTime() < NEW_PRODUCT_DAYS * DAY_MS;

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-fg/50">
      <div className="relative aspect-square overflow-hidden bg-surface-raised">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt[locale]}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-500 motion-safe:group-hover:scale-105",
              !product.inStock && "opacity-60 grayscale",
            )}
          />
        ) : (
          <div className="grid size-full place-items-center">
            <ImageOff className="size-10 text-muted" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {!product.inStock ? <Badge tone="cyan">{t("soldOut")}</Badge> : null}
          {product.inStock && discount > 0 ? (
            <Badge tone="pink">{t("discount", { percent: discount })}</Badge>
          ) : null}
          {product.inStock && isNew ? <Badge tone="violet">{t("new")}</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{product.brand}</p>
        <h3 className="font-display text-sm leading-snug font-semibold sm:text-base">
          {/* The stretched link makes the whole card clickable while keeping one tab stop. */}
          <Link
            href={`/p/${product.slug}`}
            className={cn("rounded-sm after:absolute after:inset-0", focusRing)}
          >
            {name}
          </Link>
        </h3>
        {product.ratingCount > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <RatingStars
              rating={product.ratingAvg}
              label={t("rating", {
                rating: product.ratingAvg.toLocaleString(locale, { maximumFractionDigits: 1 }),
                count: product.ratingCount,
              })}
            />
            <span aria-hidden="true">{t("ratingShort", { count: product.ratingCount })}</span>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="sr-only">{t("currentPrice")}</span>
          <Price amount={product.price} className="text-base font-semibold sm:text-lg" />
          {product.compareAtPrice ? (
            <>
              <span className="sr-only">{t("previousPrice")}</span>
              <s>
                <Price amount={product.compareAtPrice} className="text-xs text-muted sm:text-sm" />
              </s>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
