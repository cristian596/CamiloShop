import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth";
import { AdminHeader, EmptyState, cardClass } from "@/features/admin/ui";
import { getPendingQuestions } from "@/features/questions/queries";
import { AnswerForm } from "@/features/questions/question-forms";

interface AdminQuestionsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AdminQuestionsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Admin.nav" });
  return { title: t("questions") };
}

export default async function AdminQuestionsPage({ params }: AdminQuestionsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  await requireAdmin("/admin/questions");

  const [t, format, questions] = await Promise.all([
    getTranslations("Admin.questions"),
    getFormatter(),
    getPendingQuestions(),
  ]);

  return (
    <div>
      <AdminHeader title={t("title")} description={t("count", { count: questions.length })} />
      {questions.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((question) => (
            <li key={question.id} className={`${cardClass} flex flex-col gap-4`}>
              <div className="flex flex-col gap-1">
                <Link
                  href={`/p/${question.product.slug}#questions-title`}
                  className="text-sm font-semibold text-primary-fg underline-offset-4 hover:underline"
                >
                  {locale === "en" ? question.product.nameEn : question.product.nameEs}
                </Link>
                <p className="whitespace-pre-line">{question.body}</p>
                <p className="text-xs text-muted">
                  {question.user.fullName ?? "—"} · {question.user.email} ·{" "}
                  {format.dateTime(question.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <AnswerForm questionId={question.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
