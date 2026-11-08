import { describe, expect, it } from "vitest";
import { buildReceiptPdf, toWinAnsi } from "@/features/orders/receipt";
import {
  addCartLine,
  applyCartSnapshot,
  cartCount,
  cartSubtotal,
  setCartQuantity,
  type CartLine,
} from "@/stores/cart";

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  variantId: "v1",
  productId: "p1",
  slug: "camiseta",
  sku: "CS-028-M-NEGRO",
  name: { es: "Camiseta", en: "T-shirt" },
  brand: "Distrito",
  image: null,
  size: "M",
  color: "negro",
  unitPrice: 59_900,
  quantity: 1,
  maxQuantity: 5,
  ...overrides,
});

describe("cart", () => {
  it("merges repeated variants and caps by stock and per-line limit", () => {
    let lines = addCartLine([], line({ quantity: 3 }));
    lines = addCartLine(lines, line({ quantity: 4 }));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(5);

    const big = addCartLine([], line({ quantity: 50, maxQuantity: 99 }));
    expect(big[0]?.quantity).toBe(10);
  });

  it("removes a line when its quantity drops to zero", () => {
    expect(setCartQuantity([line()], "v1", 0)).toEqual([]);
  });

  it("counts units and subtotal", () => {
    const lines = [
      line({ quantity: 2 }),
      line({ variantId: "v2", unitPrice: 10_000, quantity: 1 }),
    ];
    expect(cartCount(lines)).toBe(3);
    expect(cartSubtotal(lines)).toBe(129_800);
  });

  it("applies server prices and stock and reports every change", () => {
    const { lines, changes } = applyCartSnapshot(
      [line({ quantity: 4 }), line({ variantId: "v2" }), line({ variantId: "v3" })],
      [
        { variantId: "v1", available: true, unitPrice: 54_900, stock: 2 },
        { variantId: "v2", available: false, unitPrice: 59_900, stock: 3 },
        { variantId: "v3", available: true, unitPrice: 59_900, stock: 3 },
      ],
    );
    expect(lines.map((item) => [item.variantId, item.quantity, item.unitPrice])).toEqual([
      ["v1", 2, 54_900],
      ["v3", 1, 59_900],
    ]);
    expect(changes).toEqual([
      { type: "price", variantId: "v1", before: 59_900, after: 54_900 },
      { type: "quantity", variantId: "v1", before: 4, after: 2 },
      { type: "removed", variantId: "v2" },
    ]);
  });
});

describe("receipt PDF", () => {
  it("replaces characters the standard PDF fonts cannot encode", () => {
    expect(toWinAnsi("Bogotá · Ñandú – “ok” 🚀")).toBe("Bogotá · Ñandú – “ok” ?");
  });

  it("builds a PDF with the order data", async () => {
    const bytes = await buildReceiptPdf(
      {
        number: "CS-2026-000001",
        createdAt: new Date("2026-11-07T15:00:00Z"),
        status: "PENDING",
        paymentMethod: "COD",
        customer: { name: "Ana 😀 Pérez", email: "ana@example.com" },
        address: {
          recipient: "Ana",
          phone: "3001234567",
          line1: "Calle 10 # 43-21",
          line2: null,
          city: "Medellín",
          department: "Antioquia",
        },
        items: Array.from({ length: 40 }, (_, index) => ({
          name: `Producto con un nombre bastante largo número ${index + 1}`,
          variant: "M · Negro",
          quantity: 1,
          unitPrice: 10_000,
          lineTotal: 10_000,
        })),
        subtotal: 400_000,
        discount: 40_000,
        couponCode: "CLAUDE10",
        shippingCost: 0,
        taxBase: 302_521,
        taxAmount: 57_479,
        total: 360_000,
      },
      "es",
      { status: "Pendiente", payment: "Contra entrega" },
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2_000);
  });
});
