import { LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { focusRing } from "@/components/ui/styles";
import { CartButton } from "@/features/cart/cart-button";
import { CurrencySwitcher } from "./currency-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const [t, tc, user] = await Promise.all([
    getTranslations("Header"),
    getTranslations("Categories"),
    getCurrentUser(),
  ]);
  const displayName = user ? (user.name ?? user.email) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-3 lg:gap-6">
        <MobileMenu />
        <Logo className="shrink-0" />
        <SearchBox className="hidden max-w-xl flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher className="hidden lg:flex" />
          <CurrencySwitcher className="hidden lg:flex" />
          <ThemeToggle />
          {displayName ? (
            <Link
              href="/account"
              aria-label={t("accountOf", { name: displayName })}
              className={buttonClasses({ variant: "ghost", size: "icon" })}
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-sm font-semibold text-on-primary uppercase">
                {displayName.charAt(0)}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className={buttonClasses({ variant: "ghost", size: "sm", className: "px-2 sm:px-3" })}
            >
              <LogIn className="size-5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t("signIn")}</span>
            </Link>
          )}
          <CartButton />
        </div>
      </Container>
      <Container className="pb-3 md:hidden">
        <SearchBox />
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
