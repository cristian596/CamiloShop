"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RecentlyViewedItem {
  slug: string;
  name: { es: string; en: string };
  brand: string;
  /** COP, VAT included. */
  price: number;
  compareAtPrice: number | null;
  image: { url: string; alt: { es: string; en: string } } | null;
}

export const RECENTLY_VIEWED_LIMIT = 12;

/** Most recent first, without duplicates, capped at `limit`. */
export function addRecentlyViewed(
  items: RecentlyViewedItem[],
  item: RecentlyViewedItem,
  limit = RECENTLY_VIEWED_LIMIT,
): RecentlyViewedItem[] {
  return [item, ...items.filter((existing) => existing.slug !== item.slug)].slice(0, limit);
}

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  add: (item: RecentlyViewedItem) => void;
  clear: () => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((state) => ({ items: addRecentlyViewed(state.items, item) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "camiloshop-recently-viewed",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Rehydrated after mount (see Providers) so server and client markup match.
      skipHydration: true,
    },
  ),
);
