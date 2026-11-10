import { getTranslations } from "next-intl/server";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { publicEnv } from "@/lib/env";
import { CookieSettingsButton } from "@/features/consent/consent-manager";
import { Container } from "@/components/ui/container";
import { focusRing } from "@/components/ui/styles";
import { Logo } from "./logo";

const linkClass = cn("rounded-md text-sm text-muted hover:text-fg", focusRing);

export async function Footer() {
  const t = await getTranslations("Footer");
  const tc = await getTranslations("Categories");
  const tCommon = await getTranslations("Common");

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-muted">{t("tagline")}</p>
        </div>
        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="mb-3 font-display text-sm font-semibold">
            {t("shop")}
          </h2>
          <ul className="flex flex-col gap-2">
            {ROOT_CATEGORIES.map((root) => (
              <li key={root.key}>
                <Link href={categoryHref(root.slug)} className={linkClass}>
                  {tc(root.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-3 font-display text-sm font-semibold">
            {t("help")}
          </h2>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/legal/terms" className={linkClass}>
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className={linkClass}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/legal/returns" className={linkClass}>
                {t("returns")}
              </Link>
            </li>
            {publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
              <li>
                <CookieSettingsButton className={cn(linkClass, "text-left")} />
              </li>
            ) : null}
          </ul>
        </nav>
        <p className="text-sm text-muted sm:col-span-2 lg:col-span-1">
          {tCommon("portfolioNotice")}
        </p>
      </Container>
      <div className="border-t border-line">
        <Container className="py-6 text-xs text-muted">
          {t("rights", { year: new Date().getFullYear() })}
        </Container>
      </div>
    </footer>
  );
}
