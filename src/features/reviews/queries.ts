import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { hasDeliveredPurchase } from "./service";

export const REVIEWS_SHOWN = 20;

/**
 * Latest reviews of a product plus all its ratings (for the star distribution).
 * Cached per request: the reviews section and the JSON-LD both use it.
 */
export const getProductReviews = cache(async (productId: string) => {
  const db = getDb();
  const [reviews, ratings] = await Promise.all([
    db.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: REVIEWS_SHOWN,
      select: {
        id: true,
        userId: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
    }),
    db.review.findMany({ where: { productId }, select: { rating: true } }),
  ]);
  return { reviews, ratings: ratings.map((row) => row.rating) };
});

export type ReviewViewerState = "guest" | "eligible" | "notEligible" | "reviewed";

/** What the review form should show to this viewer. */
export async function getReviewViewerState(
  productId: string,
  userId: string | null,
): Promise<ReviewViewerState> {
  if (!userId) return "guest";
  const db = getDb();
  const existing = await db.review.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  });
  if (existing) return "reviewed";
  return (await hasDeliveredPurchase(db, userId, productId)) ? "eligible" : "notEligible";
}
