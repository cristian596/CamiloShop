import { Heart, MapPin, Package, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getDb } from "@/lib/db";
import { focusRing } from "@/components/ui/styles";

interface AccountPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AccountPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Account" });
  return { title: t("title") };
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser("/account");

  const db = getDb();
  const [t, format, profile, addressCount, favoriteCount] = await Promise.all([
    getTranslations("Account"),
    getFormatter(),
    db.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, role: true, createdAt: true },
    }),
    db.address.count({ where: { userId: user.id } }),
    db.favorite.count({ where: { userId: user.id, product: { isActive: true } } }),
  ]);

  const cards = [
    { href: "/account/profile", label: t("profile"), icon: UserRound, value: null },
    { href: "/account/addresses", label: t("addresses"), icon: MapPin, value: addressCount },
    { href: "/account/orders", label: t("orders"), icon: Package, value: 0 },
    { href: "/account/favorites", label: t("favorites"), icon: Heart, value: favoriteCount },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t("greeting", { name: profile?.fullName ?? user.name ?? user.email })}
        </h1>
        <p className="text-muted">{t("overviewText")}</p>
        {profile ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {t("memberSince", { date: format.dateTime(profile.createdAt, { dateStyle: "long" }) })}
            {profile.role === "ADMIN" ? (
              <Link
                href="/admin"
                className={cn(
                  "rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-on-primary",
                  focusRing,
                )}
              >
                {t("roleAdmin")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, label, icon: Icon, value }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-cyan-fg/50",
                focusRing,
              )}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-surface-raised text-cyan-fg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex-1 font-medium">{label}</span>
              {value !== null ? (
                <span className="font-display text-xl font-semibold">{value}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
