"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/features/checkout/pricing";

/**
 * A cart line as shown in the browser. Prices here are only for display: the
 * server recomputes every amount from the database at checkout.
 */
export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  sku: string;
  name: { es: string; en: string };
  brand: string;
  image: { url: string; alt: { es: string; en: string } } | null;
  size: string | null;
  color: string | null;
  /** COP, VAT included, as last seen. */
  unitPrice: number;
  quantity: number;
  /** Stock as last seen; caps the quantity selector. */
  maxQuantity: number;
}

export interface CartSnapshotLine {
  variantId: string;
  available: boolean;
  unitPrice: number;
  stock: number;
}

export type CartChange =
  | { type: "price"; variantId: string; before: number; after: number }
  | { type: "quantity"; variantId: string; before: number; after: number }
  | { type: "removed"; variantId: string };

function capQuantity(quantity: number, maxQuantity: number) {
  return Math.max(0, Math.min(Math.floor(quantity), MAX_LINE_QUANTITY, maxQuantity));
}

/** Adds a line or increases an existing one, capped by stock and per-line limit. */
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((item) => item.variantId === line.variantId);
  if (existing) {
    return lines.map((item) =>
      item.variantId === line.variantId
        ? {
            ...line,
            quantity: capQuantity(item.quantity + line.quantity, line.maxQuantity),
          }
        : item,
    );
  }
  if (lines.length >= MAX_CART_LINES) return lines;
  const quantity = capQuantity(line.quantity, line.maxQuantity);
  return quantity > 0 ? [...lines, { ...line, quantity }] : lines;
}

export function setCartQuantity(lines: CartLine[], variantId: string, quantity: number) {
  return lines.flatMap((item) => {
    if (item.variantId !== variantId) return [item];
    const next = capQuantity(quantity, item.maxQuantity);
    return next > 0 ? [{ ...item, quantity: next }] : [];
  });
}

/**
 * Applies fresh prices and stock from the server and reports what changed, so
 * the cart can tell the user instead of silently changing amounts.
 */
export function applyCartSnapshot(
  lines: CartLine[],
  snapshot: CartSnapshotLine[],
): { lines: CartLine[]; changes: CartChange[] } {
  const byId = new Map(snapshot.map((line) => [line.variantId, line]));
  const changes: CartChange[] = [];
  const next: CartLine[] = [];

  for (const line of lines) {
    const fresh = byId.get(line.variantId);
    if (!fresh || !fresh.available || fresh.stock <= 0) {
      changes.push({ type: "removed", variantId: line.variantId });
      continue;
    }
    const quantity = capQuantity(line.quantity, fresh.stock);
    if (fresh.unitPrice !== line.unitPrice) {
      changes.push({
        type: "price",
        variantId: line.variantId,
        before: line.unitPrice,
        after: fresh.unitPrice,
      });
    }
    if (quantity !== line.quantity) {
      changes.push({
        type: "quantity",
        variantId: line.variantId,
        before: line.quantity,
        after: quantity,
      });
    }
    next.push({ ...line, unitPrice: fresh.unitPrice, maxQuantity: fresh.stock, quantity });
  }
  return { lines: next, changes };
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

interface CartState {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  replace: (lines: CartLine[]) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) => set((state) => ({ lines: addCartLine(state.lines, line) })),
      setQuantity: (variantId, quantity) =>
        set((state) => ({ lines: setCartQuantity(state.lines, variantId, quantity) })),
      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.variantId !== variantId) })),
      replace: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "camiloshop-cart",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Rehydrated after mount (see Providers) so server and client markup match.
      skipHydration: true,
    },
  ),
);

/** Drawer visibility; not persisted. */
export const useCartDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

const subscribeHydration = (onChange: () => void) => useCart.persist.onFinishHydration(onChange);

/** False on the server and until localStorage is read, so markup matches on hydration. */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}
