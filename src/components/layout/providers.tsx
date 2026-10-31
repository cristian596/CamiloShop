"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { usePreferences } from "@/stores/preferences";
import { useRecentlyViewed } from "@/stores/recently-viewed";
import { StoreConfigProvider } from "./store-config";

interface ProvidersProps {
  usdRate: number;
  children: ReactNode;
}

export function Providers({ usdRate, children }: ProvidersProps) {
  useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useRecentlyViewed.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <StoreConfigProvider value={{ usdRate }}>{children}</StoreConfigProvider>
    </ThemeProvider>
  );
}
