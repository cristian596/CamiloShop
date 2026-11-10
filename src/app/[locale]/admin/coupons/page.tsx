import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import { CouponForm } from "@/features/admin/coupon-form";
import { toStoreDateTimeInput } from "@/features/admin/coupon-schema";
import { AdminHeader, EmptyState, cardClass } from "@/features/admin/ui";

interface AdminCouponsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AdminCouponsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("coupons") };
}

export default async function AdminCouponsPage({ params }: AdminCouponsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin("/admin/coupons");

  const [t, format, coupons] = await Promise.all([
    getTranslations("Admin.coupons"),
    getFormatter(),
    getDb().coupon.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const now = new Date();

  const stateOf = (coupon: (typeof coupons)[number]) => {
    if (!coupon.isActive) return { tone: "pink", key: "inactive" } as const;
    if (coupon.endsAt && coupon.endsAt <= now) return { tone: "pink", key: "expired" } as const;
    if (coupon.startsAt && coupon.startsAt > now)
      return { tone: "violet", key: "scheduled" } as const;
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { tone: "pink", key: "exhausted" } as const;
    }
    return { tone: "cyan", key: "active" } as const;
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader title={t("title")} description={t("hint")} />

      <section className={cardClass} aria-labelledby="new-coupon">
        <h2 id="new-coupon" className="mb-4 font-semibold">
          {t("new")}
        </h2>
        <CouponForm
          values={{
            code: "",
            type: "PERCENT",
            value: "",
            isActive: true,
            startsAt: "",
            endsAt: "",
            maxUses: "",
            minSubtotal: "0",
            usedCount: 0,
          }}
        />
      </section>

      {coupons.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {coupons.map((coupon) => {
            const state = stateOf(coupon);
            return (
              <li key={coupon.id}>
                <details className={cn(cardClass, "group")}>
                  <summary
                    className={cn(
                      "flex cursor-pointer flex-wrap items-center gap-3 rounded-lg",
                      focusRing,
                    )}
                  >
                    <span className="font-mono font-semibold">{coupon.code}</span>
                    <Badge tone={state.tone}>{t(`states.${state.key}`)}</Badge>
                    <span className="text-sm text-muted">
                      {coupon.type === "PERCENT"
                        ? `${coupon.value} %`
                        : formatPrice(coupon.value, { locale })}
                      {" · "}
                      {t("uses", {
                        used: coupon.usedCount,
                        max: coupon.maxUses ?? "∞",
                      })}
                      {coupon.endsAt
                        ? ` · ${t("until", { date: format.dateTime(coupon.endsAt, { dateStyle: "medium", timeStyle: "short" }) })}`
                        : ""}
                    </span>
                    <span className="ml-auto text-sm text-primary-fg group-open:hidden">
                      {t("edit")}
                    </span>
                  </summary>
                  <div className="mt-5 border-t border-line pt-5">
                    <CouponForm
                      values={{
                        id: coupon.id,
                        code: coupon.code,
                        type: coupon.type,
                        value: String(coupon.value),
                        isActive: coupon.isActive,
                        startsAt: toStoreDateTimeInput(coupon.startsAt),
                        endsAt: toStoreDateTimeInput(coupon.endsAt),
                        maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
                        minSubtotal: String(coupon.minSubtotal),
                        usedCount: coupon.usedCount,
                      }}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
