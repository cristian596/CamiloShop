"use client";

import { createContext, useContext, type ReactNode } from "react";

interface StoreConfig {
  /** Display-only COP→USD rate, read from the Setting table on the server. */
  usdRate: number;
}

const StoreConfigContext = createContext<StoreConfig | null>(null);

export function StoreConfigProvider({
  value,
  children,
}: {
  value: StoreConfig;
  children: ReactNode;
}) {
  return <StoreConfigContext value={value}>{children}</StoreConfigContext>;
}

export function useStoreConfig(): StoreConfig {
  const config = useContext(StoreConfigContext);
  if (!config) throw new Error("useStoreConfig must be used inside StoreConfigProvider");
  return config;
}
