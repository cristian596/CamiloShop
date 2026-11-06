import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LEGAL_PAGES, LEGAL_VERSION, type LegalPage } from "@/config/legal";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/container";
import { focusRing } from "@/components/ui/styles";
import { LEGAL_CONTENT } from "@/features/legal/content";

interface LegalPageProps {
  params: Promise<{ locale: string; page: string }>;
}

function isLegalPage(value: string): value is LegalPage {
  return (LEGAL_PAGES as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isLegalPage(page)) return {};
  const t = await getTranslations({ locale: locale as Locale, namespace: "Legal" });
  const path = `/legal/${page}`;
  return {
    title: t(`titles.${page}`),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { es: `/es${path}`, en: `/en${path}` },
    },
  };
}

export default async function LegalDocumentPage({ params }: LegalPageProps) {
  const { locale: rawLocale, page } = await params;
  if (!isLegalPage(page)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [t, format] = await Promise.all([getTranslations("Legal"), getFormatter()]);
  const sections = LEGAL_CONTENT[page][locale];

  return (
    <Container className="max-w-3xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t(`titles.${page}`)}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {t("updated", {
          date: format.dateTime(new Date(`${LEGAL_VERSION}T12:00:00Z`), { dateStyle: "long" }),
        })}
        {" · "}
        {t("version", { version: LEGAL_VERSION })}
      </p>

      <div role="note" className="mt-6 flex gap-3 rounded-2xl border border-pink-fg/40 p-4 text-sm">
        <Scale className="mt-0.5 size-5 shrink-0 text-pink-fg" aria-hidden="true" />
        <p>{t("templateNotice")}</p>
      </div>

      <nav
        aria-labelledby="legal-contents"
        className="mt-8 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="legal-contents" className="mb-3 font-display text-sm font-semibold">
          {t("contents")}
        </h2>
        <ol className="flex flex-col gap-1.5 text-sm">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cn("rounded-sm text-muted hover:text-fg", focusRing)}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="scroll-mt-24"
          >
            <h2 id={`${section.id}-title`} className="mb-3 font-display text-xl font-semibold">
              {section.title}
            </h2>
            <div className="flex flex-col gap-3 leading-relaxed text-muted">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  );
}
