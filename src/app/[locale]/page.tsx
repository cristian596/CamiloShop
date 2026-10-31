import { ArrowRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROOT_CATEGORIES, categoryHref } from "@/config/categories";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { focusRing } from "@/components/ui/styles";
import { MOCK_FEATURED } from "@/features/catalog/mock-products";
import { ProductCard } from "@/features/catalog/product-card";

// Each module has a single dominant neon accent:
// hero + featured → violet, categories + benefits → cyan, promo → pink.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The locale segment is validated in the layout before any page renders.
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Home");
  const tc = await getTranslations("Categories");

  const benefits = [
    { icon: Truck, title: t("benefitShippingTitle"), text: t("benefitShippingText") },
    { icon: ShieldCheck, title: t("benefitPaymentTitle"), text: t("benefitPaymentText") },
    { icon: RotateCcw, title: t("benefitReturnsTitle"), text: t("benefitReturnsText") },
  ];

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden border-b border-line"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-violet)_0%,transparent_55%)] opacity-30"
        />
        <Container className="relative flex flex-col gap-6 py-20 sm:py-28 lg:py-32">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary-fg uppercase">
            {t("heroEyebrow")}
          </p>
          <h1
            id="hero-title"
            className="max-w-3xl font-display text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg text-muted">{t("heroText")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={categoryHref("tecnologia")} className={buttonClasses({ size: "lg" })}>
              {t("heroCta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={categoryHref("ropa")}
              className={buttonClasses({ variant: "outline", size: "lg" })}
            >
              {t("heroSecondary")}
            </Link>
          </div>
        </Container>
      </section>

      <section aria-labelledby="categories-title" className="py-16">
        <Container>
          <SectionHeading
            id="categories-title"
            title={t("categoriesTitle")}
            description={t("categoriesText")}
          />
          <ul className="grid gap-4 sm:grid-cols-3">
            {ROOT_CATEGORIES.map((root) => {
              const Icon = root.icon;
              return (
                <li key={root.key}>
                  <Link
                    href={categoryHref(root.slug)}
                    className={cn(
                      "group flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-cyan-fg/60",
                      focusRing,
                    )}
                  >
                    <Icon className="size-8 text-cyan-fg" aria-hidden="true" />
                    <span className="font-display text-xl font-semibold">{tc(root.key)}</span>
                    <span className="text-sm text-muted">
                      {root.children.map((child) => tc(child.key)).join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="featured-title" className="py-16">
        <Container>
          <SectionHeading
            id="featured-title"
            title={t("featuredTitle")}
            description={t("featuredText")}
          />
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {MOCK_FEATURED.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="promo-title" className="py-16">
        <Container>
          <div className="flex flex-col items-start gap-3 rounded-3xl border border-pink-fg/40 bg-surface p-8 sm:p-12">
            <h2 id="promo-title" className="font-display text-2xl font-bold sm:text-3xl">
              {t("promoTitle")}
            </h2>
            <p className="text-muted">{t("promoText", { code: "CLAUDE10" })}</p>
            <p className="rounded-full border border-dashed border-pink-fg px-4 py-1.5 font-mono text-lg font-semibold tracking-widest text-pink-fg">
              CLAUDE10
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="benefits-title" className="py-16">
        <Container>
          <h2 id="benefits-title" className="sr-only">
            {t("benefitsTitle")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface p-6">
                <Icon className="size-6 shrink-0 text-cyan-fg" aria-hidden="true" />
                <div>
                  <h3 className="font-display font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
