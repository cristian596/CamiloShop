import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createReview, deleteReview, hasDeliveredPurchase } from "@/features/reviews/service";

/**
 * Review eligibility and rating sync against the real database. Uses its own
 * product, a fresh delivered order and a second, never-ordered product.
 */
const connectionString = process.env.DIRECT_URL;
const demoEmail = process.env.DEMO_USER_EMAIL;
const runId = Date.now().toString(36).toUpperCase();

describe.skipIf(!connectionString || !demoEmail)(
  "reviews (integration)",
  { timeout: 60_000 },
  () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString ?? "" }),
    });
    let userId = "";
    let otherUserId = "";
    let boughtId = "";
    let notBoughtId = "";

    const makeProduct = async (suffix: string) => {
      const [category, brand] = await Promise.all([
        db.category.findFirstOrThrow({ where: { parentId: { not: null } } }),
        db.brand.findFirstOrThrow(),
      ]);
      return db.product.create({
        data: {
          slug: `integration-review-${suffix}-${runId.toLowerCase()}`,
          nameEs: "Producto reseña",
          nameEn: "Review product",
          descriptionEs: "Prueba",
          descriptionEn: "Test",
          price: 50_000,
          categoryId: category.id,
          brandId: brand.id,
          variants: { create: { sku: `ITR-${suffix}-${runId}`, stock: 3 } },
        },
        include: { variants: true },
      });
    };

    const ratingOf = (id: string) =>
      db.product.findUniqueOrThrow({
        where: { id },
        select: { ratingAvg: true, ratingCount: true },
      });

    beforeAll(async () => {
      userId = (await db.profile.findUniqueOrThrow({ where: { email: demoEmail } })).id;
      otherUserId = (
        await db.profile.findFirstOrThrow({ where: { id: { not: userId } }, select: { id: true } })
      ).id;
      const bought = await makeProduct("b");
      const notBought = await makeProduct("n");
      boughtId = bought.id;
      notBoughtId = notBought.id;

      // A delivered order (historical: no stock reserved) for the demo user.
      const variant = bought.variants[0]!;
      await db.order.create({
        data: {
          number: `IT-REV-${runId}`,
          userId,
          status: "DELIVERED",
          paymentMethod: "COD",
          subtotal: 50_000,
          shippingCost: 0,
          taxBase: 42_017,
          taxAmount: 7_983,
          total: 50_000,
          shippingAddress: {},
          termsAcceptedAt: new Date(),
          termsVersion: "test",
          deliveredAt: new Date(),
          items: {
            create: {
              productId: bought.id,
              variantId: variant.id,
              productName: bought.nameEs,
              unitPrice: 50_000,
              quantity: 1,
              lineTotal: 50_000,
            },
          },
        },
      });
    });

    afterAll(async () => {
      await db.order.deleteMany({ where: { number: `IT-REV-${runId}` } });
      await db.product.deleteMany({ where: { id: { in: [boughtId, notBoughtId] } } });
      await db.$disconnect();
    });

    it("only lets customers with a delivered order review", async () => {
      await expect(hasDeliveredPurchase(db, userId, boughtId)).resolves.toBe(true);
      await expect(hasDeliveredPurchase(db, userId, notBoughtId)).resolves.toBe(false);
      await expect(
        createReview(db, {
          userId,
          productId: notBoughtId,
          rating: 5,
          title: null,
          body: "No lo compré",
        }),
      ).resolves.toEqual({ ok: false, error: "notEligible" });
      await expect(
        createReview(db, {
          userId: otherUserId,
          productId: boughtId,
          rating: 1,
          title: null,
          body: "Nunca lo pedí",
        }),
      ).resolves.toEqual({ ok: false, error: "notEligible" });
      expect(await ratingOf(notBoughtId)).toEqual({ ratingAvg: 0, ratingCount: 0 });
    });

    it("keeps the product rating in sync, one review per customer", async () => {
      await expect(
        createReview(db, {
          userId,
          productId: boughtId,
          rating: 4,
          title: "Bien",
          body: "Buena calidad por el precio",
        }),
      ).resolves.toEqual({ ok: true });
      expect(await ratingOf(boughtId)).toEqual({ ratingAvg: 4, ratingCount: 1 });

      await expect(
        createReview(db, {
          userId,
          productId: boughtId,
          rating: 1,
          title: null,
          body: "Segunda reseña",
        }),
      ).resolves.toEqual({ ok: false, error: "alreadyReviewed" });
      expect(await ratingOf(boughtId)).toEqual({ ratingAvg: 4, ratingCount: 1 });

      const review = await db.review.findFirstOrThrow({ where: { productId: boughtId } });
      // Someone else cannot delete it; its author can, and the rating resets.
      await expect(deleteReview(db, review.id, { id: otherUserId, isAdmin: false })).resolves.toBe(
        false,
      );
      await expect(deleteReview(db, review.id, { id: userId, isAdmin: false })).resolves.toBe(true);
      expect(await ratingOf(boughtId)).toEqual({ ratingAvg: 0, ratingCount: 0 });
    });
  },
);
