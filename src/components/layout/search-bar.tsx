import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";

/** Plain GET form; suggestions and the results page arrive in phase 2b. */
export function SearchBar({ className, action }: { className?: string; action: string }) {
  const t = useTranslations("Header");

  return (
    <form role="search" action={action} method="get" className={cn("relative w-full", className)}>
      <label htmlFor="site-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        className={cn(
          "h-11 w-full rounded-full border border-line bg-surface pr-12 pl-4 text-sm text-fg placeholder:text-muted",
          focusRing,
        )}
      />
      <button
        type="submit"
        aria-label={t("searchSubmit")}
        className={cn(
          "absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-primary text-on-primary hover:bg-primary-hover",
          focusRing,
        )}
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}
