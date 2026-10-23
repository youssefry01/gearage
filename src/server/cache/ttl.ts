/**
 * Tiny in-process cache with a time-to-live and single-flight loading: concurrent callers share one load, and a
 * failed load is NOT cached (the next call retries). Per server instance (on serverless, per warm instance), so it
 * only smooths bursts; it is never the source of truth. Reads of rarely-changing reference data (category tree,
 * spec definitions) use it so a listing request does not re-read them from the database every time.
 */
export type TtlCache<T> = { get(): Promise<T>; clear(): void };

export function ttlCache<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): TtlCache<T> {
  let value: { data: T; at: number } | undefined;
  let inflight: Promise<T> | undefined;
  return {
    async get() {
      if (value && now() - value.at < ttlMs) return value.data;
      if (!inflight) {
        inflight = load()
          .then((data) => {
            value = { data, at: now() };
            return data;
          })
          .finally(() => {
            inflight = undefined;
          });
      }
      return inflight;
    },
    clear() {
      value = undefined;
      inflight = undefined;
    },
  };
}
