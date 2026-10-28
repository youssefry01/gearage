import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { RECENT_MAX, parseStoredRecent, pushRecent } from "@/domain/recently-viewed";

/**
 * Recently viewed products, kept on this device only (localStorage; no server record, no account link). View
 * COUNTING for best-seller / most-viewed ranking is a different thing and ships with the rate limiter (M5a).
 */
export type RecentState = {
  slugs: string[];
  record: (slug: string) => void;
  removeMany: (slugs: readonly string[]) => void;
  clear: () => void;
};

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      slugs: [],
      record: (slug) => set((s) => ({ slugs: pushRecent(s.slugs, slug, RECENT_MAX) })),
      removeMany: (slugs) => set((s) => ({ slugs: s.slugs.filter((x) => !slugs.includes(x)) })),
      clear: () => set({ slugs: [] }),
    }),
    {
      name: "recently-viewed",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ slugs: s.slugs }),
      merge: (persisted, current) => ({
        ...current,
        slugs: parseStoredRecent((persisted as { slugs?: unknown } | null)?.slugs),
      }),
      skipHydration: true,
    },
  ),
);
