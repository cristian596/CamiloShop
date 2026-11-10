import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { placeOrder } from "@/features/checkout/place-order";
import { changeOrderStatus } from "@/features/admin/order-service";
import { productSchema } from "@/features/admin/product-schema";

vi.mock("server-only", () => ({}));
const { saveProduct } = await import("@/features/admin/product-service");

/**
 * Admin order and product services against the real database. Creates and
 * removes its own products, so the seeded catalog is never touched.
 */
const connectionString = process.env.DIRECT_URL;
const demoEmail = process.env.DEMO_USER_EMAIL;
const runId = Date.now().toString(36).toUpperCase();

describe.skipIf(!connectionString || !demoEmail)(
  "admin services (integration)",
  { timeout: 60_000 },
  () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString ?? "" }),
    });
    let userId = "";
    let addressId = "";
    let categoryId = "";
    let brandId = "";
    let productId = "";
    let variantId = "";
    const createdProducts: string[] = [];

    const stockOf = async () =>
      (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
    const soldOf = async () =>
      (await db.product.findUniqueOrThrow({ where: { id: productId } })).soldCount;

    const placeTestOrder = async (paymentMethod: "COD" | "CARD", quantity = 2) => {
      const result = await placeOrder(
        db,
        userId,
        {
          lines: [{ variantId, quantity }],
          addressId,
          couponCode: "",
          paymentMethod,
          acceptTerms: true,
        },
        { expiresInMinutes: 30, termsVersion: "test" },
      );
      if (!result.ok) throw new Error(`placeOrder failed: ${result.error}`);
      return result.orderId;
    };

    beforeAll(async () => {
      userId = (await db.profile.findUniqueOrThrow({ where: { email: demoEmail } })).id;
      addressId = (
        await db.address.create({
          data: {
            userId,
            label: `Admin ${runId}`,
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
      categoryId = category.id;
      brandId = brand.id;
      const product = await db.product.create({
        data: {
          slug: `integration-admin-${runId.toLowerCase()}`,
          nameEs: "Producto admin",
          nameEn: "Admin product",
          descriptionEs: "Prueba",
          descriptionEn: "Test",
          price: 100_000,
          categoryId,
          brandId,
          variants: { create: { sku: `ITA-${runId}`, stock: 10 } },
        },
        include: { variants: true },
      });
      productId = product.id;
      variantId = product.variants[0]!.id;
      createdProducts.push(productId);
    });

    afterAll(async () => {
      await db.order.deleteMany({
        where: { items: { some: { productId: { in: createdProducts } } } },
      });
      await db.product.deleteMany({ where: { id: { in: createdProducts } } });
      await db.address.deleteMany({ where: { id: addressId } });
      await db.$disconnect();
    });

    it("confirms cash on delivery, ships and delivers, recording each step once", async () => {
      const orderId = await placeTestOrder("COD");
      const soldBefore = await soldOf();
      const step = (
        expectedFrom: "PENDING" | "PAID" | "SHIPPED",
        to: "PAID" | "SHIPPED" | "DELIVERED",
      ) => changeOrderStatus(db, { orderId, expectedFrom, to, actorId: userId, note: null });

      await expect(step("PENDING", "PAID")).resolves.toEqual({ ok: true, from: "PENDING" });
      // A second admin acting on the stale page loses the race.
      await expect(step("PENDING", "PAID")).resolves.toEqual({ ok: false, error: "conflict" });
      await expect(step("PAID", "SHIPPED")).resolves.toMatchObject({ ok: true });
      await expect(step("SHIPPED", "DELIVERED")).resolves.toMatchObject({ ok: true });

      const order = await db.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: true, statusHistory: { orderBy: { createdAt: "asc" } } },
      });
      expect(order.status).toBe("DELIVERED");
      expect(order.paidAt && order.shippedAt && order.deliveredAt).toBeTruthy();
      expect(order.expiresAt).toBeNull();
      expect(order.payments.map((payment) => payment.status)).toEqual(["APPROVED"]);
      expect(order.statusHistory.map((entry) => entry.to)).toEqual([
        "PENDING",
        "PAID",
        "SHIPPED",
        "DELIVERED",
      ]);
      expect(await soldOf()).toBe(soldBefore + 2);
    });

    it("refuses to mark a card order as paid by hand", async () => {
      const orderId = await placeTestOrder("CARD", 1);
      await expect(
        changeOrderStatus(db, {
          orderId,
          expectedFrom: "PENDING",
          to: "PAID",
          actorId: userId,
          note: null,
        }),
      ).resolves.toEqual({ ok: false, error: "invalid" });
      expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
    });

    it("cancelling a paid order returns its stock and takes it out of the sales count", async () => {
      const orderId = await placeTestOrder("COD", 3);
      await changeOrderStatus(db, {
        orderId,
        expectedFrom: "PENDING",
        to: "PAID",
        actorId: userId,
        note: null,
      });
      const [stockPaid, soldPaid] = [await stockOf(), await soldOf()];

      await expect(
        changeOrderStatus(db, {
          orderId,
          expectedFrom: "PAID",
          to: "CANCELLED",
          actorId: userId,
          note: "customer asked",
        }),
      ).resolves.toEqual({ ok: true, from: "PAID" });

      expect(await stockOf()).toBe(stockPaid + 3);
      expect(await soldOf()).toBe(soldPaid - 3);
      const history = await db.orderStatusHistory.findFirstOrThrow({
        where: { orderId, to: "CANCELLED" },
      });
      expect(history).toMatchObject({ from: "PAID", changedById: userId, note: "customer asked" });
    });

    const productInput = (overrides: Record<string, unknown> = {}) =>
      productSchema.parse({
        nameEs: "Gorra admin",
        nameEn: "Admin cap",
        slug: `gorra-admin-${runId.toLowerCase()}`,
        descriptionEs: "Prueba",
        descriptionEn: "Test",
        categoryId,
        brandId,
        price: "45000",
        compareAtPrice: "",
        isActive: false,
        isFeatured: false,
        variants: [
          { sku: `GA-${runId}-N`, size: "U", color: "black", priceOverride: "", stock: "4" },
          { sku: `GA-${runId}-B`, size: "U", color: "white", priceOverride: "49000", stock: "2" },
        ],
        ...overrides,
      });

    it("creates a product with variants and reconciles them on update", async () => {
      const created = await saveProduct(db, null, productInput());
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      createdProducts.push(created.productId);

      const variants = await db.productVariant.findMany({
        where: { productId: created.productId },
        orderBy: { sku: "asc" },
      });
      expect(variants.map((variant) => [variant.sku, variant.colorHex, variant.stock])).toEqual([
        [`GA-${runId}-B`, "#f9fafb", 2],
        [`GA-${runId}-N`, "#111827", 4],
      ]);

      // Keep the black one (new stock), drop the white one, add a gray one.
      const black = variants.find((variant) => variant.color === "black")!;
      const updated = await saveProduct(
        db,
        created.productId,
        productInput({
          variants: [
            {
              id: black.id,
              sku: black.sku,
              size: "U",
              color: "black",
              priceOverride: "",
              stock: "9",
            },
            { sku: `GA-${runId}-G`, size: "U", color: "gray", priceOverride: "", stock: "1" },
          ],
        }),
      );
      expect(updated).toEqual({ ok: true, productId: created.productId });
      const after = await db.productVariant.findMany({
        where: { productId: created.productId },
        orderBy: { sku: "asc" },
      });
      expect(after.map((variant) => [variant.sku, variant.stock])).toEqual([
        [`GA-${runId}-G`, 1],
        [`GA-${runId}-N`, 9],
      ]);
    });

    it("keeps variants that were ordered and reports taken slugs and SKUs", async () => {
      // The fixture variant has orders from the tests above: it cannot be removed.
      const input = productInput({
        slug: `integration-admin-${runId.toLowerCase()}`,
        variants: [{ sku: `NEW-${runId}`, size: "", color: "", priceOverride: "", stock: "1" }],
      });
      await expect(saveProduct(db, productId, input)).resolves.toMatchObject({
        ok: false,
        error: "variantInUse",
      });
      expect(await db.productVariant.count({ where: { productId } })).toBe(1);

      await expect(
        saveProduct(db, null, productInput({ slug: `integration-admin-${runId.toLowerCase()}` })),
      ).resolves.toMatchObject({ ok: false, error: "slugTaken" });
      await expect(
        saveProduct(
          db,
          null,
          productInput({
            slug: `otra-${runId.toLowerCase()}`,
            variants: [{ sku: `ITA-${runId}`, size: "", color: "", priceOverride: "", stock: "1" }],
          }),
        ),
      ).resolves.toMatchObject({ ok: false, error: "skuTaken" });
    });
  },
);
