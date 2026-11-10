import { MessageCircleQuestion, Store, Trash2 } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import { publicName } from "@/features/reviews/rules";
import { deleteQuestionAction } from "./actions";
import { getProductQuestions } from "./queries";
import { AnswerForm, AskQuestionForm } from "./question-forms";

export async function QuestionsSection({
  productId,
  slug,
  locale,
  viewer,
}: {
  productId: string;
  slug: string;
  locale: Locale;
  viewer: { id: string; isAdmin: boolean } | null;
}) {
  const [t, format, questions] = await Promise.all([
    getTranslations("Questions"),
    getFormatter(),
    getProductQuestions(productId, viewer),
  ]);
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  return (
    <section aria-labelledby="questions-title" className="border-t border-line pt-10">
      <h2 id="questions-title" className="mb-6 font-display text-2xl font-bold tracking-tight">
        {t("title")}
      </h2>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5 lg:self-start">
          {viewer ? (
            <AskQuestionForm productId={productId} />
          ) : (
            <p className="text-sm text-muted">
              {t.rich("signInToAsk", {
                link: (chunks) => (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/${locale}/p/${slug}#questions-title`)}`}
                    className="font-medium text-primary-fg underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
        </div>

        {questions.length === 0 ? (
          <p className="text-sm text-muted">{t("none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {questions.map((question) => {
              const pending = question.answers.length === 0;
              const mine = viewer?.id === question.userId;
              return (
                <li key={question.id} className="flex flex-col gap-3 py-5 first:pt-0">
                  <div className="flex gap-3">
                    <MessageCircleQuestion
                      className="mt-0.5 size-5 shrink-0 text-primary-fg"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-medium whitespace-pre-line">{question.body}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>
                          {publicName(question.user.fullName, t("anonymous"))} ·{" "}
                          {date(question.createdAt)}
                        </span>
                        {pending ? <Badge tone="pink">{t("pending")}</Badge> : null}
                        {mine || viewer?.isAdmin ? (
                          <form action={deleteQuestionAction}>
                            <input type="hidden" name="questionId" value={question.id} />
                            <button
                              type="submit"
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:text-pink-fg",
                                focusRing,
                              )}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                              {mine ? t("deleteMine") : t("deleteModerate")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {question.answers.map((answer) => (
                    <div
                      key={answer.id}
                      className="ml-8 flex gap-3 rounded-xl bg-surface-raised p-3"
                    >
                      <Store className="mt-0.5 size-4 shrink-0 text-cyan-fg" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-sm whitespace-pre-line">{answer.body}</p>
                        <p className="text-xs text-muted">
                          {t("storeAnswer")} · {date(answer.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {pending && viewer?.isAdmin ? (
                    <div className="ml-8">
                      <AnswerForm questionId={question.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
