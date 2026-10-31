/** Color keys used by product variants; names are translated in messages (Colors.*). */
export const COLORS = {
  black: "#111827",
  white: "#f9fafb",
  gray: "#6b7280",
  silver: "#c0c4cc",
  navy: "#1e3a8a",
  blue: "#2563eb",
  green: "#15803d",
  olive: "#556b2f",
  beige: "#d6c4a8",
  cream: "#f3ead8",
  brown: "#7c4a2d",
  orange: "#c2410c",
  red: "#b91c1c",
  pink: "#ec4899",
  purple: "#7c3aed",
  nude: "#c8a08a",
} as const;

export type ColorKey = keyof typeof COLORS;

/**
 * Swatch classes, spelled out literally so Tailwind can detect them at build time.
 * Must stay in sync with COLORS.
 */
export const COLOR_SWATCH_CLASSES: Record<ColorKey, string> = {
  black: "bg-[#111827]",
  white: "bg-[#f9fafb]",
  gray: "bg-[#6b7280]",
  silver: "bg-[#c0c4cc]",
  navy: "bg-[#1e3a8a]",
  blue: "bg-[#2563eb]",
  green: "bg-[#15803d]",
  olive: "bg-[#556b2f]",
  beige: "bg-[#d6c4a8]",
  cream: "bg-[#f3ead8]",
  brown: "bg-[#7c4a2d]",
  orange: "bg-[#c2410c]",
  red: "bg-[#b91c1c]",
  pink: "bg-[#ec4899]",
  purple: "bg-[#7c3aed]",
  nude: "bg-[#c8a08a]",
};

export function isColorKey(value: string): value is ColorKey {
  return Object.hasOwn(COLORS, value);
}

/** Display order for size facets; unknown sizes are appended alphabetically. */
export const SIZE_ORDER = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "30 ml",
  "50 ml",
  "100 ml",
  "200 ml",
  "400 ml",
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
] as const;

export function sortSizes(sizes: string[]): string[] {
  const rank = (size: string) => {
    const index = (SIZE_ORDER as readonly string[]).indexOf(size);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Products created within this window show the "New" badge. */
export const NEW_PRODUCT_DAYS = 14;

export const PAGE_SIZE = 12;
