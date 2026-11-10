"use client";

import {
  LayoutDashboard,
  MessageCircleQuestion,
  Package,
  Shapes,
  ShoppingBag,
  TicketPercent,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";

const ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", key: "orders", icon: ShoppingBag, exact: false },
  { href: "/admin/products", key: "products", icon: Package, exact: false },
  { href: "/admin/categories", key: "categories", icon: Shapes, exact: false },
  { href: "/admin/coupons", key: "coupons", icon: TicketPercent, exact: false },
  { href: "/admin/questions", key: "questions", icon: MessageCircleQuestion, exact: false },
  { href: "/admin/users", key: "users", icon: Users, exact: false },
] as const;

export function AdminNav() {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col">
        {ITEMS.map(({ href, key, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-xl",
                  focusRing,
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
      </ul>
    </nav>
  );
}
