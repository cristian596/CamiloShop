import { describe, expect, it, vi } from "vitest";
import { isQuestionVisible, questionSchema } from "@/features/questions/rules";
import { publicName, reviewSchema, summarizeRatings } from "@/features/reviews/rules";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://shop.example" },
}));
const { breadcrumbJsonLd, jsonLdString, localizedAlternates, productJsonLd } =
  await import("@/lib/seo");

describe("publicName", () => {
  it.each([
    ["Camilo Higuera", "Camilo H."],
    ["maría  fernanda   lópez", "María L."],
    ["Ana", "Ana"],
    ["  ", "Cliente"],
    [null, "Cliente"],
  ])("%s -> %s", (input, expected) => {
    expect(publicName(input, "Cliente")).toBe(expected);
  });
});

describe("summarizeRatings", () => {
  it("averages to one decimal and counts each star level", () => {
    const summary = summarizeRatings([5, 4, 4, 1]);
    expect(summary.average).toBe(3.5);
    expect(summary.count).toBe(4);
    expect(summary.distribution).toEqual([
      { stars: 5, count: 1 },
      { stars: 4, count: 2 },
      { stars: 3, count: 0 },
      { stars: 2, count: 0 },
      { stars: 1, count: 1 },
    ]);
  });

  it("is zero without reviews", () => {
    expect(summarizeRatings([])).toMatchObject({ average: 0, count: 0 });
  });
});

describe("reviewSchema", () => {
  it("accepts 1-5 stars and trims the texts", () => {
    expect(reviewSchema.parse({ rating: "5", title: "  ", body: "  Muy buena calidad  " })).toEqual(
      {
        rating: 5,
        title: null,
        body: "Muy buena calidad",
      },
    );
  });

  it.each([
    [{ rating: "0", title: "", body: "Texto suficiente" }, "rating"],
    [{ rating: "6", title: "", body: "Texto suficiente" }, "rating"],
    [{ rating: "4", title: "", body: "Corto" }, "tooShort"],
    [{ rating: "4", title: "x".repeat(81), body: "Texto suficiente" }, "tooLong"],
  ])("rejects %j with %s", (input, message) => {
    const result = reviewSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("questions", () => {
  const admin = { id: "admin", isAdmin: true };
  const author = { id: "author", isAdmin: false };
  const visitor = { id: "other", isAdmin: false };

  it("shows unanswered questions only to their author and to admins", () => {
    const pending = { userId: "author", answerCount: 0 };
    expect(isQuestionVisible(pending, author)).toBe(true);
    expect(isQuestionVisible(pending, admin)).toBe(true);
    expect(isQuestionVisible(pending, visitor)).toBe(false);
    expect(isQuestionVisible(pending, null)).toBe(false);
  });

  it("shows answered questions to everyone", () => {
    expect(isQuestionVisible({ userId: "author", answerCount: 1 }, null)).toBe(true);
  });

  it("requires a real question", () => {
    expect(questionSchema.safeParse("¿Talla?").success).toBe(false);
    expect(questionSchema.safeParse("¿Viene en talla XL?").success).toBe(true);
  });
});

describe("SEO helpers", () => {
  it("builds canonical and hreflang (with x-default) for a locale-less path", () => {
    expect(localizedAlternates("en", "/p/gorra")).toEqual({
      canonical: "/en/p/gorra",
      languages: { es: "/es/p/gorra", en: "/en/p/gorra", "x-default": "/es/p/gorra" },
    });
    expect(localizedAlternates("es", "/")).toMatchObject({ canonical: "/es" });
  });

  it("escapes < so user text cannot close the JSON-LD script", () => {
    const html = jsonLdString({ reviewBody: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("</script>");
    expect(JSON.parse(html)).toEqual({ reviewBody: "</script><script>alert(1)</script>" });
  });

  it("numbers breadcrumbs with absolute URLs", () => {
    expect(
      breadcrumbJsonLd("es", [
        { name: "CamiloShop", path: "/" },
        { name: "Ropa", path: "/c/ropa" },
      ]).itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "CamiloShop", item: "https://shop.example/es" },
      { "@type": "ListItem", position: 2, name: "Ropa", item: "https://shop.example/es/c/ropa" },
    ]);
  });

  const product = {
    locale: "es" as const,
    slug: "gorra",
    name: "Gorra",
    description: "Algodón",
    brand: "Urbano Co.",
    images: ["https://img.example/gorra.jpg"],
    variants: [
      { sku: "G-1", price: 45_000, inStock: false },
      { sku: "G-2", price: 45_000, inStock: true },
    ],
    rating: { average: 0, count: 0 },
    reviews: [],
  };

  it("uses a single Offer when every variant costs the same, and no rating without reviews", () => {
    const data = productJsonLd(product);
    expect(data.offers).toMatchObject({
      "@type": "Offer",
      price: 45_000,
      priceCurrency: "COP",
      availability: "https://schema.org/InStock",
    });
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
  });

  it("uses an AggregateOffer for different prices and mirrors the real reviews", () => {
    const data = productJsonLd({
      ...product,
      variants: [
        { sku: "G-1", price: 45_000, inStock: false },
        { sku: "G-2", price: 52_000, inStock: false },
      ],
      rating: { average: 4.333, count: 3 },
      reviews: [
        {
          author: "Ana P.",
          rating: 5,
          body: "Excelente",
          title: null,
          date: new Date("2026-11-01T15:00:00Z"),
        },
      ],
    });
    expect(data.offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 45_000,
      highPrice: 52_000,
      availability: "https://schema.org/OutOfStock",
    });
    expect(data).toMatchObject({
      aggregateRating: { ratingValue: 4.3, reviewCount: 3 },
      review: [{ author: { "@type": "Person", name: "Ana P." }, datePublished: "2026-11-01" }],
    });
  });
});
