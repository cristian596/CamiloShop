import { Prisma, type PrismaClient } from "@prisma/client";
import type { ReviewErrorKey, ReviewInput } from "./rules";

/*
 * Review writes. They take the Prisma client as a parameter so integration
 * tests run them against the real database.
 */

/** Only customers who received the product (a DELIVERED order containing it). */
export async function hasDeliveredPurchase(
  db: Pick<PrismaClient, "orderItem">,
  userId: string,
  productId: string,
): Promise<boolean> {
  const count = await db.orderItem.count({
    where: { productId, order: { userId, status: "DELIVERED" } },
  });
  return count > 0;
}

/**
 * Recomputes a product's rating from its reviews. Runs inside the transaction
 * that changed the reviews, after the product row was locked, so concurrent
 * reviews cannot leave a stale average.
 */
async function syncProductRating(tx: Prisma.TransactionClient, productId: string) {
  await tx.$executeRaw`
    UPDATE "Product" p
    SET "ratingAvg" = coalesce((SELECT avg(r.rating)::float FROM "Review" r WHERE r."productId" = p.id), 0),
        "ratingCount" = (SELECT count(*)::int FROM "Review" r WHERE r."productId" = p.id)
    WHERE p.id = ${productId}::uuid`;
}

async function lockProduct(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`;
  return rows.length === 1;
}

export type CreateReviewResult = { ok: true } | { ok: false; error: ReviewErrorKey };

export async function createReview(
  db: PrismaClient,
  input: ReviewInput & { userId: string; productId: string },
): Promise<CreateReviewResult> {
  try {
    return await db.$transaction(async (tx) => {
      if (!(await lockProduct(tx, input.productId)))
        return { ok: false, error: "generic" } as const;
      if (!(await hasDeliveredPurchase(tx, input.userId, input.productId))) {
        return { ok: false, error: "notEligible" } as const;
      }
      await tx.review.create({
        data: {
          productId: input.productId,
          userId: input.userId,
          rating: input.rating,
          title: input.title,
          body: input.body,
        },
      });
      await syncProductRating(tx, input.productId);
      return { ok: true } as const;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "alreadyReviewed" };
    }
    console.error("[reviews] create failed", error);
    return { ok: false, error: "generic" };
  }
}

/** Deletes a review (its author, or an admin moderating) and updates the rating. */
export async function deleteReview(
  db: PrismaClient,
  reviewId: string,
  actor: { id: string; isAdmin: boolean },
): Promise<boolean> {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { productId: true, userId: true },
  });
  if (!review || (review.userId !== actor.id && !actor.isAdmin)) return false;

  return db.$transaction(async (tx) => {
    await lockProduct(tx, review.productId);
    const deleted = await tx.review.deleteMany({ where: { id: reviewId } });
    if (deleted.count === 0) return false;
    await syncProductRating(tx, review.productId);
    return true;
  });
}
