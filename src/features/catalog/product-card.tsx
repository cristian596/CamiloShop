import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import { Price } from "@/components/layout/price";
import type { MockProduct } from "./mock-products";

export async function ProductCard({ product }: { product: MockProduct }) {
  const t = await getTranslations("Product");
  const locale = (await getLocale()) as Locale;
  const name = product.name[locale];
  const discount = product.compareAtPrice
    ? discountPercent(product.compareAtPrice, product.price)
    : 0;
  const Icon = product.icon;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-fg/50">
      <div className="relative grid aspect-square place-items-center bg-linear-to-br from-violet/25 via-surface-raised to-surface">
        <Icon
          className="size-16 text-primary-fg transition-transform duration-300 motion-safe:group-hover:scale-110"
          aria-hidden="true"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {discount > 0 ? <Badge tone="pink">{t("discount", { percent: discount })}</Badge> : null}
          {product.isNew ? <Badge tone="violet">{t("new")}</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{product.brand}</p>
        <h3 className="font-display text-base leading-snug font-semibold">
          {/* The stretched link makes the whole card clickable while keeping one tab stop. */}
          <Link
            href={`/p/${product.slug}`}
            className={cn("rounded-sm after:absolute after:inset-0", focusRing)}
          >
            {name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-2">
          <span className="sr-only">{t("currentPrice")}</span>
          <Price amount={product.price} className="text-lg font-semibold" />
          {product.compareAtPrice ? (
            <>
              <span className="sr-only">{t("previousPrice")}</span>
              <s>
                <Price amount={product.compareAtPrice} className="text-sm text-muted" />
              </s>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
