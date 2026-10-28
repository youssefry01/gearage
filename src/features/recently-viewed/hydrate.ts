import { useRecentStore } from "./store";

let pending: Promise<void> | null = null;

/** Rehydrate the recently viewed list ONCE per page load; every caller awaits the same promise (no overwrite races). */
export function ensureRecentHydrated(): Promise<void> {
  pending ??= Promise.resolve(useRecentStore.persist.rehydrate()).then(() => undefined);
  return pending;
}
