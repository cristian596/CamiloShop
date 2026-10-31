import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "./styles";

type Href = ComponentProps<typeof Link>["href"];

export interface BreadcrumbItem {
  label: string;
  /** Omitted for the current page. */
  href?: Href;
}

export async function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const t = await getTranslations("Breadcrumbs");
  const all: BreadcrumbItem[] = [{ label: t("home"), href: "/" }, ...items];

  return (
    <nav aria-label={t("label")} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {all.map((item, index) => {
          const isLast = index === all.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className={cn("rounded-sm hover:text-fg", focusRing)}>
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(isLast && "text-fg")}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
