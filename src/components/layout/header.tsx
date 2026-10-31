import { ShoppingBag, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { focusRing } from "@/components/ui/styles";
import { CurrencySwitcher } from "./currency-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const t = await getTranslations("Header");
  const tc = await getTranslations("Categories");
  const locale = await getLocale();
  const searchAction = `/${locale}/search`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-3 lg:gap-6">
        <MobileMenu />
        <Logo className="shrink-0" />
        <SearchBar action={searchAction} className="hidden max-w-xl flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher className="hidden lg:flex" />
          <CurrencySwitcher className="hidden lg:flex" />
          <ThemeToggle />
          <Link
            href="/account"
            aria-label={t("account")}
            className={buttonClasses({ variant: "ghost", size: "icon" })}
          >
            <User className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/cart"
            aria-label={t("cart")}
            className={buttonClasses({ variant: "ghost", size: "icon" })}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </Container>
      <Container className="pb-3 md:hidden">
        <SearchBar action={searchAction} />
      </Container>
      <nav aria-label={t("mainNav")} className="hidden border-t border-line lg:block">
        <Container>
          <ul className="flex h-11 items-center gap-8 text-sm">
            {ROOT_CATEGORIES.map((root) => (
              <li key={root.key}>
                <Link
                  href={categoryHref(root.slug)}
                  className={cn("rounded-md font-medium text-muted hover:text-fg", focusRing)}
                >
                  {tc(root.key)}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </nav>
    </header>
  );
}
