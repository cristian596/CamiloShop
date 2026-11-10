import { describe, expect, it } from "vitest";
import {
  couponSchema,
  parseStoreDateTime,
  toStoreDateTimeInput,
} from "@/features/admin/coupon-schema";
import { sniffImageType } from "@/features/admin/image-file";
import { adminTransitions } from "@/features/admin/order-transitions";
import { adminFieldErrors, productSchema, slugify } from "@/features/admin/product-schema";
import { queryHref } from "@/features/admin/query-href";
import { canTransition } from "@/features/orders/status";

describe("adminTransitions", () => {
  it("lets the admin confirm cash on delivery as paid", () => {
    expect(adminTransitions("PENDING", "COD")).toEqual(["PAID", "CANCELLED"]);
  });

  it("never marks a card or PSE order as paid by hand", () => {
    expect(adminTransitions("PENDING", "CARD")).toEqual(["CANCELLED"]);
    expect(adminTransitions("PENDING", "PSE")).toEqual(["CANCELLED"]);
  });

  it("follows the store state machine afterwards", () => {
    expect(adminTransitions("PAID", "CARD")).toEqual(["SHIPPED", "CANCELLED"]);
    expect(adminTransitions("SHIPPED", "COD")).toEqual(["DELIVERED"]);
    expect(adminTransitions("DELIVERED", "COD")).toEqual([]);
    expect(adminTransitions("CANCELLED", "CARD")).toEqual([]);
  });

  it("is always a subset of the store transitions", () => {
    for (const status of ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const) {
      for (const method of ["CARD", "PSE", "COD"] as const) {
        for (const target of adminTransitions(status, method)) {
          expect(canTransition(status, target)).toBe(true);
        }
      }
    }
  });
});

describe("slugify", () => {
  it.each([
    ["Audífonos Pro X", "audifonos-pro-x"],
    ["  Crema   Hidratante  ", "crema-hidratante"],
    ["Camiseta 100% algodón!", "camiseta-100-algodon"],
    ["Ñandú – edición", "nandu-edicion"],
    ["---", ""],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("sniffImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...Array(16).fill(0)]);
  const text = (value: string) => [...value].map((char) => char.charCodeAt(0));

  it("recognises the allowed formats by their signature", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")))).toBe("image/webp");
    expect(sniffImageType(bytes(0, 0, 0, 0x1c, ...text("ftypavif")))).toBe("image/avif");
  });

  it("rejects anything else, whatever the file is called", () => {
    expect(sniffImageType(bytes(...text("<svg xmlns")))).toBeNull();
    expect(sniffImageType(bytes(...text("<!DOCTYPE html>")))).toBeNull();
    expect(sniffImageType(bytes(...text("GIF89a")))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("productSchema", () => {
  const base = {
    nameEs: "Camiseta",
    nameEn: "T-shirt",
    slug: "camiseta",
    descriptionEs: "Algodón",
    descriptionEn: "Cotton",
    categoryId: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    brandId: "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d",
    price: "59900",
    compareAtPrice: "",
    isActive: true,
    isFeatured: false,
    variants: [{ sku: "cam-001", size: "M", color: "black", priceOverride: "", stock: "5" }],
  };

  it("normalises a valid product", () => {
    const parsed = productSchema.parse(base);
    expect(parsed.price).toBe(59_900);
    expect(parsed.compareAtPrice).toBeNull();
    expect(parsed.variants[0]).toMatchObject({ sku: "CAM-001", color: "black", stock: 5 });
  });

  it("reports duplicate SKUs and size/color combinations per row", () => {
    const result = productSchema.safeParse({
      ...base,
      variants: [
        { sku: "A-1", size: "M", color: "black", priceOverride: "", stock: "1" },
        { sku: "a-1", size: "M", color: "black", priceOverride: "", stock: "1" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(adminFieldErrors(result.error)).toMatchObject({
        "variants.1.sku": "skuDuplicate",
        "variants.1.size": "duplicateVariant",
      });
    }
  });

  it("rejects unknown colors and negative stock", () => {
    const result = productSchema.safeParse({
      ...base,
      variants: [{ sku: "A-1", size: "", color: "magenta", priceOverride: "", stock: "-1" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = adminFieldErrors(result.error);
      expect(errors["variants.0.color"]).toBe("invalid");
      expect(errors["variants.0.stock"]).toBe("invalid");
    }
  });

  it("rejects a compare-at price that is not higher than the price", () => {
    // Cross-field rules run once the fields themselves are valid (Zod 4).
    const result = productSchema.safeParse({ ...base, compareAtPrice: "59900" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(adminFieldErrors(result.error).compareAtPrice).toBe("compareAtInvalid");
    }
  });

  it("requires at least one variant and a URL-safe slug", () => {
    const result = productSchema.safeParse({ ...base, slug: "Camiseta Negra", variants: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(adminFieldErrors(result.error)).toMatchObject({
        slug: "slugInvalid",
        variants: "variantsRequired",
      });
    }
  });
});

describe("coupon dates and rules", () => {
  it("reads datetime-local values as Colombia time (UTC-5, no DST)", () => {
    expect(parseStoreDateTime("2026-12-31T23:59")?.toISOString()).toBe("2027-01-01T04:59:00.000Z");
    expect(parseStoreDateTime("31/12/2026")).toBeNull();
    expect(toStoreDateTimeInput(new Date("2027-01-01T04:59:00Z"))).toBe("2026-12-31T23:59");
    expect(toStoreDateTimeInput(null)).toBe("");
  });

  const coupon = {
    code: " navidad-10 ",
    type: "PERCENT",
    value: "10",
    isActive: true,
    startsAt: "",
    endsAt: "",
    maxUses: "",
    minSubtotal: "0",
  };

  it("normalises the code and empty limits", () => {
    expect(couponSchema.parse(coupon)).toMatchObject({
      code: "NAVIDAD-10",
      value: 10,
      startsAt: null,
      maxUses: null,
    });
  });

  it("caps percentages and requires the end after the start", () => {
    expect(couponSchema.safeParse({ ...coupon, value: "95" }).success).toBe(false);
    expect(couponSchema.safeParse({ ...coupon, type: "FIXED", value: "95000" }).success).toBe(true);
    expect(
      couponSchema.safeParse({
        ...coupon,
        startsAt: "2026-12-01T00:00",
        endsAt: "2026-11-01T00:00",
      }).success,
    ).toBe(false);
  });
});

describe("queryHref", () => {
  it("keeps only meaningful params and drops page 1", () => {
    expect(queryHref("/admin/orders", { q: "CS-1", status: undefined, page: 1 })).toBe(
      "/admin/orders?q=CS-1",
    );
    expect(queryHref("/admin/orders", { q: "", page: 3 })).toBe("/admin/orders?page=3");
  });
});
