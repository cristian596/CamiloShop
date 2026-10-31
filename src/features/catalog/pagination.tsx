import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { getPaginationItems } from "./listing-params";

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  /** Locale-less href for a page, keeping the rest of the query intact. */
  hrefForPage: (page: number) => string;
}

const itemClass = cn(
  "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm",
  focusRing,
);

export async function Pagination({ currentPage, pageCount, hrefForPage: href }: PaginationProps) {
  if (pageCount <= 1) return null;
  const t = await getTranslations("Pagination");
  const current = Math.min(currentPage, pageCount);

  return (
    <nav aria-label={t("label")} className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {current > 1 ? (
            <Link
              href={href(current - 1)}
              rel="prev"
              className={cn(itemClass, "gap-1 hover:bg-surface-raised")}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("previous")}</span>
              <span className="sr-only sm:hidden">{t("previous")}</span>
            </Link>
          ) : null}
        </li>
        {getPaginationItems(current, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <li key={`ellipsis-${index}`} aria-hidden="true" className="px-2 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              {item === current ? (
                <span
                  aria-current="page"
                  aria-label={t("current", { page: item })}
                  className={cn(itemClass, "bg-primary font-semibold text-on-primary")}
                >
                  {item}
                </span>
              ) : (
                <Link
                  href={href(item)}
                  aria-label={t("page", { page: item })}
                  className={cn(itemClass, "hover:bg-surface-raised")}
                >
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {current < pageCount ? (
            <Link
              href={href(current + 1)}
              rel="next"
              className={cn(itemClass, "gap-1 hover:bg-surface-raised")}
            >
              <span className="hidden sm:inline">{t("next")}</span>
              <span className="sr-only sm:hidden">{t("next")}</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
