"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * next/image optimization on Cloudflare requires the paid Images product, so the
 * resizing is delegated to the image CDN instead. Unsplash (imgix) and Pexels both
 * accept width/quality/format params. Other sources (e.g. Supabase Storage uploads,
 * compressed on upload) are served as-is.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const q = String(quality ?? 75);

  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", q);
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    return url.toString();
  }

  if (src.startsWith("https://images.pexels.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("auto", "compress");
    url.searchParams.set("cs", "tinysrgb");
    return url.toString();
  }

  return src;
}
