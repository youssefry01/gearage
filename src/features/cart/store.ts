import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * MINIMAL cart store for the header badge. M6a replaces the line model (variants, bundle components, stock
 * validation, server merge on login) but keeps this module's public shape: `useCartStore`, `selectCartCount`.
 * Persisted to localStorage; hydration is manual (`persist.rehydrate()`) so server and client markup agree.
 */
export type CartState = {
  lines: Record<string, number>;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const toQty = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      add: (productId, qty = 1) =>
        set((s) => ({
          lines: { ...s.lines, [productId]: toQty((s.lines[productId] ?? 0) + toQty(qty)) },
        })),
      setQty: (productId, qty) =>
        set((s) => {
          const next = { ...s.lines };
          if (toQty(qty) === 0) delete next[productId];
          else next[productId] = toQty(qty);
          return { lines: next };
        }),
      remove: (productId) =>
        set((s) => {
          const next = { ...s.lines };
          delete next[productId];
          return { lines: next };
        }),
      clear: () => set({ lines: {} }),
    }),
    {
      name: "cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      skipHydration: true,
    },
  ),
);

/** Total units across all lines. */
export const selectCartCount = (s: Pick<CartState, "lines">): number =>
  Object.values(s.lines).reduce((sum, q) => sum + q, 0);
