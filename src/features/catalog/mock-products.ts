import type { LucideIcon } from "lucide-react";
import {
  Footprints,
  Gamepad2,
  Headphones,
  Shirt,
  Smartphone,
  Sparkles,
  SprayCan,
  Watch,
} from "lucide-react";

export interface MockProduct {
  id: string;
  slug: string;
  brand: string;
  name: { es: string; en: string };
  /** Integer COP, VAT included. */
  price: number;
  compareAtPrice?: number;
  isNew?: boolean;
  icon: LucideIcon;
}

// Placeholder data for the phase 1 home. Replaced by seeded products in phase 2a.
export const MOCK_FEATURED: MockProduct[] = [
  {
    id: "1",
    slug: "audifonos-nova-pulse-anc",
    brand: "Nova Audio",
    name: { es: "Audífonos Pulse ANC", en: "Pulse ANC Headphones" },
    price: 489_900,
    compareAtPrice: 589_900,
    icon: Headphones,
  },
  {
    id: "2",
    slug: "kairo-x12-128gb",
    brand: "Kairo",
    name: { es: "Smartphone X12 128 GB", en: "X12 Smartphone 128 GB" },
    price: 1_349_900,
    isNew: true,
    icon: Smartphone,
  },
  {
    id: "3",
    slug: "lumen-fit-band-2",
    brand: "Lumen Labs",
    name: { es: "Reloj Fit Band 2", en: "Fit Band 2 Watch" },
    price: 329_900,
    icon: Watch,
  },
  {
    id: "4",
    slug: "vertice-control-pro",
    brand: "Vértice",
    name: { es: "Control Pro inalámbrico", en: "Wireless Pro Controller" },
    price: 259_900,
    compareAtPrice: 299_900,
    icon: Gamepad2,
  },
  {
    id: "5",
    slug: "aurum-serum-vitamina-c",
    brand: "Aurum Beauty",
    name: { es: "Sérum Vitamina C 30 ml", en: "Vitamin C Serum 30 ml" },
    price: 119_900,
    isNew: true,
    icon: Sparkles,
  },
  {
    id: "6",
    slug: "selva-eau-de-parfum-noir",
    brand: "Selva",
    name: { es: "Eau de Parfum Noir 100 ml", en: "Noir Eau de Parfum 100 ml" },
    price: 279_900,
    icon: SprayCan,
  },
  {
    id: "7",
    slug: "distrito-hoodie-oversize",
    brand: "Distrito",
    name: { es: "Hoodie oversize Distrito", en: "Distrito Oversized Hoodie" },
    price: 189_900,
    compareAtPrice: 229_900,
    icon: Shirt,
  },
  {
    id: "8",
    slug: "urbano-tenis-runner",
    brand: "Urbano Co.",
    name: { es: "Tenis Runner urbano", en: "Urban Runner Sneakers" },
    price: 349_900,
    icon: Footprints,
  },
];
