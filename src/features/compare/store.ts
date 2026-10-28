import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { canAddToCompare, type AddVerdict } from "@/domain/compare";
import { parseStoredCompare, type CompareItem } from "@/domain/compare-storage";

/**
 * The compare list, kept on the device (localStorage; it never leaves the browser). Rules live in domain/compare;
 * this store only applies them. Hydration is manual (`persist.rehydrate()`), as in the cart store, so server and
 * client markup agree; the compare tray (always mounted) triggers it.
 */
export type CompareNotice = { kind: "full" | "mismatch"; slug: string } | null;

export type CompareState = {
  items: CompareItem[];
  /** Why the last add was refused; shown (and announced) by the tray. Not persisted. */
  notice: CompareNotice;
  /** Add, or remove when already present. Returns what happened. */
  toggle: (item: CompareItem) => AddVerdict;
  remove: (slug: string) => void;
  removeMany: (slugs: readonly string[]) => void;
  clear: () => void;
  dismissNotice: () => void;
};

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      notice: null,
      toggle: (item) => {
        const verdict = canAddToCompare(get().items, item);
        if (verdict === "ok") set((s) => ({ items: [...s.items, item], notice: null }));
        else if (verdict === "duplicate")
          set((s) => ({ items: s.items.filter((i) => i.slug !== item.slug), notice: null }));
        else set({ notice: { kind: verdict, slug: item.slug } });
        return verdict;
      },
      remove: (slug) =>
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug), notice: null })),
      removeMany: (slugs) =>
        set((s) => ({ items: s.items.filter((i) => !slugs.includes(i.slug)), notice: null })),
      clear: () => set({ items: [], notice: null }),
      dismissNotice: () => set({ notice: null }),
    }),
    {
      name: "compare",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      // Whatever is in storage is untrusted: validate it instead of spreading it into the state.
      merge: (persisted, current) => ({
        ...current,
        items: parseStoredCompare((persisted as { items?: unknown } | null)?.items),
      }),
      skipHydration: true,
    },
  ),
);

/** Rehydrate before acting, so a fast click never overwrites what another tab saved. */
export async function ensureCompareHydrated(): Promise<void> {
  await Promise.resolve(useCompareStore.persist.rehydrate());
}
