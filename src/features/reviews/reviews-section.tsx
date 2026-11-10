import { BadgeCheck, Trash2 } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { RatingStars } from "@/components/ui/rating-stars";
import { focusRing } from "@/components/ui/styles";
import { deleteReviewAction } from "./actions";
import { getProductReviews, getReviewViewerState } from "./queries";
import { ReviewForm } from "./review-form";
import { publicName, summarizeRatings } from "./rules";

export async function ReviewsSection({
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
  const [t, format, { reviews, ratings }, viewerState] = await Promise.all([
    getTranslations("Reviews"),
    getFormatter(),
    getProductReviews(productId),
    getReviewViewerState(productId, viewer?.id ?? null),
  ]);
  const summary = summarizeRatings(ratings);
  const formatRating = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 1 });

  return (
    <section aria-labelledby="reviews-title" className="border-t border-line pt-10">
      <h2 id="reviews-title" className="mb-6 font-display text-2xl font-bold tracking-tight">
        {t("title")}
      </h2>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-6">
          {summary.count > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-end gap-2">
                <span className="font-display text-4xl font-bold">
                  {formatRating(summary.average)}
                </span>
                <span className="pb-1 text-sm text-muted">{t("outOf5")}</span>
              </p>
              <RatingStars
                rating={summary.average}
                label={t("summaryLabel", {
                  rating: formatRating(summary.average),
                  count: summary.count,
                })}
              />
              <p className="text-sm text-muted">{t("count", { count: summary.count })}</p>
              <dl className="flex flex-col gap-1.5 text-sm">
                {summary.distribution.map((row) => (
                  <div
                    key={row.stars}
                    className="grid grid-cols-[auto_1fr_2rem] items-center gap-2"
                  >
                    <dt className="whitespace-nowrap text-muted">
                      {t("stars", { count: row.stars })}
                    </dt>
                    <dd className="contents">
                      <progress
                        value={row.count}
                        max={summary.count}
                        aria-label={t("starsShare", { count: row.stars, reviews: row.count })}
                        className="h-2 w-full appearance-none overflow-hidden rounded-full bg-surface-raised [&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-bar]:bg-surface-raised [&::-webkit-progress-value]:bg-amber-500"
                      />
                      <span className="text-right text-muted">{row.count}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("none")}</p>
          )}

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-3 font-semibold">{t("write")}</h3>
            {viewerState === "eligible" ? <ReviewForm productId={productId} /> : null}
            {viewerState === "guest" ? (
              <p className="text-sm text-muted">
                {t.rich("signInToReview", {
                  link: (chunks) => (
                    <Link
                      href={`/login?next=${encodeURIComponent(`/${locale}/p/${slug}#reviews-title`)}`}
                      className="font-medium text-primary-fg underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : null}
            {viewerState === "notEligible" ? (
              <p className="text-sm text-muted">{t("onlyBuyers")}</p>
            ) : null}
            {viewerState === "reviewed" ? (
              <p className="text-sm text-muted">{t("alreadyReviewed")}</p>
            ) : null}
          </div>
        </div>

        {reviews.length === 0 ? null : (
          <ul className="flex flex-col divide-y divide-line">
            {reviews.map((review) => {
              const canDelete = viewer && (viewer.isAdmin || viewer.id === review.userId);
              return (
                <li key={review.id} className="flex flex-col gap-2 py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <RatingStars
                      rating={review.rating}
                      label={t("stars", { count: review.rating })}
                    />
                    {review.title ? <p className="font-semibold">{review.title}</p> : null}
                  </div>
                  <p className="leading-relaxed whitespace-pre-line text-muted">{review.body}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="font-medium text-fg">
                      {publicName(review.user.fullName, t("anonymous"))}
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-fg">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      {t("verified")}
                    </span>
                    <time dateTime={review.createdAt.toISOString()}>
                      {format.dateTime(review.createdAt, { dateStyle: "medium" })}
                    </time>
                    {canDelete ? (
                      <form action={deleteReviewAction}>
                        <input type="hidden" name="reviewId" value={review.id} />
                        <button
                          type="submit"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:text-pink-fg",
                            focusRing,
                          )}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          {viewer.id === review.userId ? t("deleteMine") : t("deleteModerate")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
