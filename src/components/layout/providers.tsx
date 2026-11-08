"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { useCart } from "@/stores/cart";
import { usePreferences } from "@/stores/preferences";
import { useRecentlyViewed } from "@/stores/recently-viewed";
import { StoreConfigProvider, type StoreConfig } from "./store-config";

interface ProvidersProps {
  config: StoreConfig;
  children: ReactNode;
}

export function Providers({ config, children }: ProvidersProps) {
  useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useRecentlyViewed.persist.rehydrate();
    void useCart.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <StoreConfigProvider value={config}>{children}</StoreConfigProvider>
    </ThemeProvider>
  );
}
