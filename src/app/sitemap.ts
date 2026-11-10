import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/config/legal";
import { routing } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

// Built per request from the live catalog (products change from the admin).
export const dynamic = "force-dynamic";

/** One entry per indexable page, with its other-language versions as hreflang. */
function entry(
  path: string,
  options: Pick<
    MetadataRoute.Sitemap[number],
    "lastModified" | "changeFrequency" | "priority" | "images"
  > = {},
): MetadataRoute.Sitemap {
  const suffix = path === "/" ? "" : path;
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(`/${locale}${suffix}`)]),
  );
  return routing.locales.map((locale) => ({
    url: absoluteUrl(`/${locale}${suffix}`),
    alternates: { languages: { ...languages, "x-default": languages[routing.defaultLocale] } },
    ...options,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const [categories, products] = await Promise.all([
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { slug: true, parent: { select: { slug: true } } },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        slug: true,
        updatedAt: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);

  return [
    ...entry("/", { changeFrequency: "daily", priority: 1 }),
    ...categories.flatMap((category) =>
      entry(
        category.parent ? `/c/${category.parent.slug}/${category.slug}` : `/c/${category.slug}`,
        { changeFrequency: "daily", priority: category.parent ? 0.7 : 0.8 },
      ),
    ),
    ...products.flatMap((product) =>
      entry(`/p/${product.slug}`, {
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
        images: product.images.map((image) => image.url),
      }),
    ),
    ...LEGAL_PAGES.flatMap((page) =>
      entry(`/legal/${page}`, { changeFrequency: "yearly", priority: 0.2 }),
    ),
  ];
}
