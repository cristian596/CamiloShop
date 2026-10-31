import type { LucideIcon } from "lucide-react";
import { Cpu, Shirt, Sparkles } from "lucide-react";

export type CategoryKey =
  | "technology"
  | "cosmetics"
  | "fashion"
  | "audio"
  | "phones"
  | "computing"
  | "wearables"
  | "gaming"
  | "skincare"
  | "makeup"
  | "fragrances"
  | "hair"
  | "men"
  | "women"
  | "footwear"
  | "accessories";

export interface RootCategory {
  key: CategoryKey;
  slug: string;
  icon: LucideIcon;
  children: { key: CategoryKey; slug: string }[];
}

// Static navigation tree for phase 1. Phase 2a reads categories from the database.
export const ROOT_CATEGORIES: RootCategory[] = [
  {
    key: "technology",
    slug: "tecnologia",
    icon: Cpu,
    children: [
      { key: "audio", slug: "audio" },
      { key: "phones", slug: "celulares-y-accesorios" },
      { key: "computing", slug: "computacion" },
      { key: "wearables", slug: "wearables" },
      { key: "gaming", slug: "gaming" },
    ],
  },
  {
    key: "cosmetics",
    slug: "cosmeticos",
    icon: Sparkles,
    children: [
      { key: "skincare", slug: "skincare" },
      { key: "makeup", slug: "maquillaje" },
      { key: "fragrances", slug: "fragancias" },
      { key: "hair", slug: "cabello" },
    ],
  },
  {
    key: "fashion",
    slug: "ropa",
    icon: Shirt,
    children: [
      { key: "men", slug: "hombre" },
      { key: "women", slug: "mujer" },
      { key: "footwear", slug: "calzado" },
      { key: "accessories", slug: "accesorios" },
    ],
  },
];

export function categoryHref(...slugs: string[]): `/c/${string}` {
  return `/c/${slugs.join("/")}`;
}
