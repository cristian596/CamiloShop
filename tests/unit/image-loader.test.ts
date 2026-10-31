import { describe, expect, it } from "vitest";
import imageLoader from "@/lib/image-loader";

describe("imageLoader", () => {
  it("adds sizing params to Unsplash URLs", () => {
    const url = new URL(
      imageLoader({ src: "https://images.unsplash.com/photo-123", width: 640, quality: 80 }),
    );
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("80");
    expect(url.searchParams.get("auto")).toBe("format");
  });

  it("defaults the quality", () => {
    const url = new URL(imageLoader({ src: "https://images.unsplash.com/photo-123", width: 320 }));
    expect(url.searchParams.get("q")).toBe("75");
  });

  it("adds sizing params to Pexels URLs", () => {
    const url = new URL(
      imageLoader({ src: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg", width: 480 }),
    );
    expect(url.searchParams.get("w")).toBe("480");
  });

  it("leaves other sources untouched", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/product-images/a.webp";
    expect(imageLoader({ src, width: 640 })).toBe(src);
  });
});
