/**
 * "Serve the last good value" cache for data that feeds a document crawlers fetch (the sitemap): a failing load must
 * degrade, never turn into a 500.
 *
 *  - Fresh value (younger than `ttlMs`): returned without loading.
 *  - Otherwise ONE load runs (concurrent callers share it). On success the value is stored.
 *  - On failure the error is reported through `onError`, the retry is postponed by `retryMs` (so a struggling
 *    database is not hammered by every request), and the caller gets the last good value, or `fallback` when there
 *    never was one. `get()` never rejects.
 *
 * Per server instance (per warm instance on serverless). The degraded fallback is deliberately NOT remembered as if it
 * were good: the next call after `retryMs` loads again.
 */
export type LastGood<T> = {
  get(): Promise<{ value: T; degraded: boolean }>;
  clear(): void;
};

export type LastGoodOptions<T> = {
  ttlMs: number;
  retryMs: number;
  fallback: T;
  onError?: (error: unknown) => void;
  now?: () => number;
};

export function lastGood<T>(load: () => Promise<T>, options: LastGoodOptions<T>): LastGood<T> {
  const now = options.now ?? Date.now;
  let good: { value: T; at: number } | undefined;
  let failedAt: number | undefined;
  let inflight: Promise<{ value: T; degraded: boolean }> | undefined;

  const degradedResult = () => ({ value: good ? good.value : options.fallback, degraded: true });

  return {
    async get() {
      if (good && now() - good.at < options.ttlMs) return { value: good.value, degraded: false };
      if (failedAt !== undefined && now() - failedAt < options.retryMs) return degradedResult();
      if (!inflight) {
        inflight = (async () => {
          try {
            const value = await load();
            good = { value, at: now() };
            failedAt = undefined;
            return { value, degraded: false };
          } catch (error) {
            failedAt = now();
            try {
              options.onError?.(error);
            } catch {
              // a failing logger must not turn a degraded response into a failure
            }
            return degradedResult();
          } finally {
            inflight = undefined;
          }
        })();
      }
      return inflight;
    },
    clear() {
      good = undefined;
      failedAt = undefined;
      inflight = undefined;
    },
  };
}
