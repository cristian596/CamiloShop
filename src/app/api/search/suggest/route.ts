import { NextResponse, type NextRequest } from "next/server";
import { suggestProducts } from "@/features/catalog/queries";
import { normalizeSearchQuery } from "@/features/catalog/search-query";

export const dynamic = "force-dynamic";

export interface SuggestionItem {
  slug: string;
  name: { es: string; en: string };
  brand: string;
  price: number;
  image: { url: string; alt: { es: string; en: string } } | null;
}

/** Up to 6 product suggestions for the header search box. */
export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));
  if (!query) return NextResponse.json({ items: [] satisfies SuggestionItem[] });

  try {
    const products = await suggestProducts(query);
    const items: SuggestionItem[] = products.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
    }));
    return NextResponse.json(
      { items },
      // Catalog data changes rarely; a short shared cache absorbs typing bursts.
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (error) {
    console.error("[search] suggestions failed", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
