"use client";

import { Heart, LayoutDashboard, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";
import { signOutAction } from "@/features/auth/actions";

const ITEMS = [
  { href: "/account", key: "title", icon: LayoutDashboard },
  { href: "/account/profile", key: "profile", icon: UserRound },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/orders", key: "orders", icon: Package },
  { href: "/account/favorites", key: "favorites", icon: Heart },
] as const;

const itemClass = cn(
  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-xl",
  focusRing,
);

export function AccountNav() {
  const t = useTranslations("Account");
  const ta = useTranslations("Auth");
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  itemClass,
                  active
                    ? "bg-primary text-on-primary"
                    : "border border-line text-muted hover:text-fg lg:border-transparent",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
        <li className="lg:mt-4 lg:border-t lg:border-line lg:pt-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className={cn(
                itemClass,
                "w-full border border-line text-muted hover:text-fg lg:border-transparent",
              )}
            >
              <LogOut className="size-4" aria-hidden="true" />
              {ta("signOut")}
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
