import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelOrder, placeOrder, type PlaceOrderInput } from "@/features/checkout/place-order";

/**
 * Order creation against the real database: stock reservation under
 * concurrency, and idempotent cancellation that returns stock and the coupon.
 * Creates its own product, variant and coupon, and deletes them afterwards.
 * Skipped without DIRECT_URL and the seeded demo user.
 */
const connectionString = process.env.DIRECT_URL;
const demoEmail = process.env.DEMO_USER_EMAIL;
const runId = Date.now().toString(36).toUpperCase();

describe.skipIf(!connectionString || !demoEmail)(
  "orders (integration)",
  { timeout: 60_000 },
  () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString ?? "" }),
    });
    let userId = "";
    let addressId = "";
    let productId = "";
    let variantId = "";
    let couponId = "";
    const couponCode = `ITEST${runId}`;
    const options = { expiresInMinutes: 30, termsVersion: "test" };

    const input = (overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
      lines: [{ variantId, quantity: 1 }],
      addressId,
      couponCode: "",
      paymentMethod: "COD",
      acceptTerms: true,
      ...overrides,
    });
    const stock = async () =>
      (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

    beforeAll(async () => {
      const profile = await db.profile.findUniqueOrThrow({ where: { email: demoEmail } });
      userId = profile.id;
      const address = await db.address.create({
        data: {
          userId,
          label: `Integration ${runId}`,
          recipient: "Test",
          phone: "3000000000",
          department: "Antioquia",
          city: "Medellín",
          line1: "Calle 1 # 2-3",
        },
      });
      addressId = address.id;

      const [category, brand] = await Promise.all([
        db.category.findFirstOrThrow({ where: { parentId: { not: null } } }),
        db.brand.findFirstOrThrow(),
      ]);
      const product = await db.product.create({
        data: {
          slug: `integration-${runId.toLowerCase()}`,
          nameEs: "Producto de prueba",
          nameEn: "Test product",
          descriptionEs: "Prueba",
          descriptionEn: "Test",
          price: 150_000,
          // Hidden from the store: only these tests touch it.
          isActive: true,
          categoryId: category.id,
          brandId: brand.id,
          variants: { create: { sku: `IT-${runId}`, stock: 1 } },
        },
        include: { variants: true },
      });
      productId = product.id;
      variantId = product.variants[0]!.id;

      const coupon = await db.coupon.create({
        data: { code: couponCode, type: "PERCENT", value: 10, maxUses: 1 },
      });
      couponId = coupon.id;
    });

    afterAll(async () => {
      await db.order.deleteMany({ where: { items: { some: { productId } } } });
      await db.coupon.deleteMany({ where: { id: couponId } });
      await db.product.deleteMany({ where: { id: productId } });
      await db.address.deleteMany({ where: { id: addressId } });
      await db.$disconnect();
    });

    it("sells the last unit exactly once under concurrent checkouts", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => placeOrder(db, userId, input(), options)),
      );
      const placed = results.filter((result) => result.ok);
      expect(placed).toHaveLength(1);
      for (const result of results.filter((item) => !item.ok)) {
        expect(["outOfStock", "cartChanged"]).toContain(!result.ok && result.error);
      }
      expect(await stock()).toBe(0);

      const order = await db.order.findUniqueOrThrow({
        where: { id: placed[0]!.ok ? placed[0]!.orderId : "" },
        include: { items: true, payments: true, statusHistory: true },
      });
      expect(order.number).toMatch(/^CS-\d{4}-\d{6}$/);
      expect(order).toMatchObject({ status: "PENDING", subtotal: 150_000, shippingCost: 11_900 });
      expect(order.taxBase + order.taxAmount).toBe(order.total);
      expect(order.payments[0]).toMatchObject({ provider: "COD", reference: `${order.number}-A1` });
      expect(order.statusHistory.map((entry) => entry.to)).toEqual(["PENDING"]);

      // Cancelling twice releases the stock once.
      expect(await cancelOrder(db, order.id, userId, "test")).toBe(true);
      expect(await cancelOrder(db, order.id, userId, "test")).toBe(false);
      expect(await stock()).toBe(1);
      const cancelled = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: true, payments: true },
      });
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.statusHistory).toHaveLength(2);
      expect(cancelled.payments[0]?.status).toBe("VOIDED");
    });

    it("applies a coupon once and gives it back on cancellation", async () => {
      const result = await placeOrder(
        db,
        userId,
        input({ couponCode: couponCode.toLowerCase() }),
        options,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
      expect(order).toMatchObject({ discount: 15_000, couponCode, shippingCost: 11_900 });
      expect((await db.coupon.findUniqueOrThrow({ where: { id: couponId } })).usedCount).toBe(1);

      // maxUses = 1: a second order cannot use the coupon even with stock available.
      await db.productVariant.update({ where: { id: variantId }, data: { stock: 2 } });
      const second = await placeOrder(db, userId, input({ couponCode }), options);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error).toBe("coupon");

      expect(await cancelOrder(db, order.id, null, "test")).toBe(true);
      const coupon = await db.coupon.findUniqueOrThrow({ where: { id: couponId } });
      expect(coupon.usedCount).toBe(0);
      expect(await db.couponRedemption.count({ where: { orderId: order.id } })).toBe(0);
      expect(await stock()).toBe(3); // 2 set above + the 1 unit this order had reserved
    });

    it("expires pending orders whose time ran out", async () => {
      const result = await placeOrder(db, userId, input(), { ...options, expiresInMinutes: 30 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      await db.order.update({
        where: { id: result.orderId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      await db.$queryRaw`SELECT public.expire_pending_orders()`;
      const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
      expect(order.status).toBe("CANCELLED");
      expect(await stock()).toBe(3);
    });

    it("rejects an address that belongs to someone else", async () => {
      const result = await placeOrder(
        db,
        userId,
        input({ addressId: "00000000-0000-4000-8000-000000000000" }),
        options,
      );
      expect(result).toEqual({ ok: false, error: "address" });
    });
  },
);
