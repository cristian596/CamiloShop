"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Currency } from "@/lib/money";

interface PreferencesState {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: "COP",
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "camiloshop-preferences",
      storage: createJSONStorage(() => localStorage),
      // Rehydrated manually after mount to keep server and client markup identical.
      skipHydration: true,
    },
  ),
);
