import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/*
 * Default share image for every store page (products override it with their
 * own photo). Inline styles are required here: ImageResponse renders JSX to a
 * PNG with Satori, which does not read the Tailwind stylesheet.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CamiloShop";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "radial-gradient(circle at 85% 10%, #4c1d95 0%, #0b0f19 55%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
        <span>Camilo</span>
        <span style={{ color: "#a78bfa" }}>Shop</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
          {t("title").replace(/^CamiloShop — /, "")}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["#7c3aed", "#22d3ee", "#f472b6"].map((color) => (
            <div
              key={color}
              style={{ width: 96, height: 10, borderRadius: 999, background: color }}
            />
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
