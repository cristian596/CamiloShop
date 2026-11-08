"use client";

import { useEffect, useState } from "react";
import {
  applyCartSnapshot,
  useCart,
  useCartHydrated,
  type CartChange,
  type CartLine,
} from "@/stores/cart";
import { getCartSnapshotAction } from "./actions";

export interface CartSyncState {
  /** True once the stored cart has been checked against current prices and stock. */
  synced: boolean;
  changes: CartChange[];
  /** Lines as they were before the sync, to name removed products in notices. */
  previous: CartLine[];
}

/**
 * Refreshes the stored cart with current prices and stock once per page view,
 * and reports what changed so the page can tell the user.
 */
export function useCartSync(): CartSyncState {
  const hydrated = useCartHydrated();
  const [state, setState] = useState<CartSyncState>({ synced: false, changes: [], previous: [] });
  const isEmpty = useCart((cart) => cart.lines.length === 0);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const before = useCart.getState().lines;
    if (before.length === 0) return;

    getCartSnapshotAction(before.map((line) => line.variantId))
      .then((snapshot) => {
        if (cancelled) return;
        // Apply to the latest lines: the user may have changed quantities meanwhile.
        const { lines, changes } = applyCartSnapshot(useCart.getState().lines, snapshot);
        useCart.getState().replace(lines);
        setState({ synced: true, changes, previous: before });
      })
      .catch(() => {
        // Offline or server error: keep the stored cart; checkout validates again anyway.
        if (!cancelled) setState({ synced: true, changes: [], previous: before });
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // An empty cart has nothing to check.
  return { ...state, synced: state.synced || (hydrated && isEmpty) };
}
