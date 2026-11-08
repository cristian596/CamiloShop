import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cancelOrder, placeOrder } from "@/features/checkout/place-order";
import { applyWompiTransaction } from "@/features/payments/apply-transaction";
import type { WompiTransaction } from "@/lib/wompi/client";

vi.mock("server-only", () => ({}));
const { completeSimulatedPayment, findSimulatedPayment } =
  await import("@/features/payments/simulated-gateway");

/**
 * Wompi payment state machine against the real database, with transactions
 * shaped like the Wompi API returns them. Creates and removes its own product.
 */
const connectionString = process.env.DIRECT_URL;
const demoEmail = process.env.DEMO_USER_EMAIL;
const runId = Date.now().toString(36).toUpperCase();

describe.skipIf(!connectionString || !demoEmail)(
  "Wompi payments (integration)",
  { timeout: 60_000 },
  () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString ?? "" }),
    });
    let userId = "";
    let addressId = "";
    let productId = "";
    let variantId = "";

    const placeCardOrder = async () => {
      const result = await placeOrder(
        db,
        userId,
        {
          lines: [{ variantId, quantity: 1 }],
          addressId,
          couponCode: "",
          paymentMethod: "CARD",
          acceptTerms: true,
        },
        { expiresInMinutes: 30, termsVersion: "test" },
      );
      if (!result.ok) throw new Error(`placeOrder failed: ${result.error}`);
      return db.order.findUniqueOrThrow({
        where: { id: result.orderId },
        include: { payments: true },
      });
    };

    const transaction = (overrides: Partial<WompiTransaction>): WompiTransaction => ({
      id: `test-${runId}-${Math.random().toString(36).slice(2, 8)}`,
      reference: "",
      status: "APPROVED",
      amount_in_cents: 0,
      currency: "COP",
      payment_method_type: "CARD",
      status_message: null,
      ...overrides,
    });

    beforeAll(async () => {
      userId = (await db.profile.findUniqueOrThrow({ where: { email: demoEmail } })).id;
      addressId = (
        await db.address.create({
          data: {
            userId,
            label: `Integration ${runId}`,
            recipient: "Test",
            phone: "3000000000",
            department: "Antioquia",
            city: "Medellín",
            line1: "Calle 1 # 2-3",
          },
        })
      ).id;
      const [category, brand] = await Promise.all([
        db.category.findFirstOrThrow({ where: { parentId: { not: null } } }),
        db.brand.findFirstOrThrow(),
      ]);
      const product = await db.product.create({
        data: {
          slug: `integration-pay-${runId.toLowerCase()}`,
          nameEs: "Producto de prueba",
          nameEn: "Test product",
          descriptionEs: "Prueba",
          descriptionEn: "Test",
          price: 250_000,
          categoryId: category.id,
          brandId: brand.id,
          variants: { create: { sku: `ITP-${runId}`, stock: 5 } },
        },
        include: { variants: true },
      });
      productId = product.id;
      variantId = product.variants[0]!.id;
    });

    afterAll(async () => {
      await db.order.deleteMany({ where: { items: { some: { productId } } } });
      await db.product.deleteMany({ where: { id: productId } });
      await db.address.deleteMany({ where: { id: addressId } });
      await db.$disconnect();
    });

    it("keeps the order pending after a decline, then pays it with a new attempt exactly once", async () => {
      const order = await placeCardOrder();
      const first = order.payments[0]!;
      expect(first).toMatchObject({
        provider: "WOMPI",
        status: "PENDING",
        reference: `${order.number}-A1`,
      });
      const amount = Number(first.amountInCents);

      const declined = transaction({
        reference: first.reference,
        status: "DECLINED",
        amount_in_cents: amount,
      });
      await expect(applyWompiTransaction(db, declined)).resolves.toMatchObject({
        outcome: "updated",
      });
      await expect(applyWompiTransaction(db, declined)).resolves.toMatchObject({
        outcome: "unchanged",
      });
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        "PENDING",
      );

      // A late APPROVED for the declined attempt cannot flip a final status.
      await expect(
        applyWompiTransaction(db, { ...declined, status: "APPROVED" }),
      ).resolves.toMatchObject({ outcome: "unchanged" });

      // "Pay again": a second attempt with its own reference.
      const second = await db.payment.create({
        data: {
          orderId: order.id,
          provider: "WOMPI",
          reference: `${order.number}-A2`,
          method: "CARD",
          amountInCents: first.amountInCents,
        },
      });
      const approved = transaction({
        reference: second.reference,
        amount_in_cents: amount,
        payment_method_type: "PSE",
      });
      const soldBefore = (await db.product.findUniqueOrThrow({ where: { id: productId } }))
        .soldCount;

      const results = await Promise.all([
        applyWompiTransaction(db, approved),
        applyWompiTransaction(db, approved),
      ]);
      expect(results.filter((result) => result.outcome === "paid")).toHaveLength(1);

      const paid = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: { orderBy: { createdAt: "asc" } } },
      });
      expect(paid).toMatchObject({ status: "PAID", paymentMethod: "PSE", expiresAt: null });
      expect(paid.paidAt).not.toBeNull();
      expect(paid.statusHistory.map((entry) => entry.to)).toEqual(["PENDING", "PAID"]);
      expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).soldCount).toBe(
        soldBefore + 1,
      );
      expect((await db.payment.findUniqueOrThrow({ where: { id: second.id } })).providerTxId).toBe(
        approved.id,
      );
    });

    it("rejects a transaction whose amount or currency differs", async () => {
      const order = await placeCardOrder();
      const payment = order.payments[0]!;
      const amount = Number(payment.amountInCents);
      await expect(
        applyWompiTransaction(
          db,
          transaction({ reference: payment.reference, amount_in_cents: amount - 100 }),
        ),
      ).resolves.toMatchObject({ outcome: "mismatch" });
      await expect(
        applyWompiTransaction(
          db,
          transaction({ reference: payment.reference, amount_in_cents: amount, currency: "USD" }),
        ),
      ).resolves.toMatchObject({ outcome: "mismatch" });
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        "PENDING",
      );
      await cancelOrder(db, order.id, null, "test");
    });

    it("ignores unknown references and transactions for another order", async () => {
      const order = await placeCardOrder();
      const payment = order.payments[0]!;
      await expect(
        applyWompiTransaction(
          db,
          transaction({ reference: `NOPE-${runId}`, amount_in_cents: 100 }),
        ),
      ).resolves.toMatchObject({ outcome: "unknownReference" });
      await expect(
        applyWompiTransaction(
          db,
          transaction({
            reference: payment.reference,
            amount_in_cents: Number(payment.amountInCents),
          }),
          { expectedOrderId: "00000000-0000-4000-8000-000000000000" },
        ),
      ).resolves.toMatchObject({ outcome: "wrongOrder" });
      await cancelOrder(db, order.id, null, "test");
    });

    it("flags an approval that arrives after the order was cancelled", async () => {
      const order = await placeCardOrder();
      const payment = order.payments[0]!;
      await cancelOrder(db, order.id, null, "test");
      await expect(
        applyWompiTransaction(
          db,
          transaction({
            reference: payment.reference,
            amount_in_cents: Number(payment.amountInCents),
          }),
        ),
      ).resolves.toMatchObject({ outcome: "approvedAfterCancel" });
      // The money is recorded on the attempt for a manual refund; the order stays cancelled.
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
        "APPROVED",
      );
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        "CANCELLED",
      );
    });

    it("simulated gateway: only the owner resolves a live attempt, and only once", async () => {
      const order = await placeCardOrder();
      const reference = order.payments[0]!.reference;

      await expect(
        findSimulatedPayment(db, reference, "00000000-0000-4000-8000-000000000000"),
      ).resolves.toBeNull();
      await expect(
        findSimulatedPayment(db, reference, userId, new Date(Date.now() + 31 * 60_000)),
      ).resolves.toBeNull();

      const payment = await findSimulatedPayment(db, reference, userId);
      expect(payment).not.toBeNull();
      // Double click: both calls race, exactly one resolves the attempt.
      const results = await Promise.all([
        completeSimulatedPayment(db, payment!, "APPROVED"),
        completeSimulatedPayment(db, payment!, "APPROVED"),
      ]);
      expect(results.filter((result) => result?.outcome === "paid")).toHaveLength(1);
      expect(results.filter((result) => result === null)).toHaveLength(1);

      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
      const stored = await db.payment.findUniqueOrThrow({ where: { reference } });
      expect(stored.status).toBe("APPROVED");
      expect(stored.providerTxId).toMatch(/^sim_/);
      await expect(findSimulatedPayment(db, reference, userId)).resolves.toBeNull();
    });

    it("simulated gateway: a decline keeps the order pending for a new attempt", async () => {
      const order = await placeCardOrder();
      const payment = await findSimulatedPayment(db, order.payments[0]!.reference, userId);
      await expect(completeSimulatedPayment(db, payment!, "DECLINED")).resolves.toMatchObject({
        outcome: "updated",
      });
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        "PENDING",
      );
      await cancelOrder(db, order.id, null, "test");
    });
  },
);
