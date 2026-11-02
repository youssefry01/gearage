import { Redis } from "@upstash/redis";
import { hitCounter } from "@/server/repositories/rate-limit.repository";

/** A fixed-window counter: add one hit and say how many there are in the live window and when it ends. */
export type CounterStore = {
  readonly name: "upstash" | "postgres";
  hit(key: string, windowSec: number, nowMs: number): Promise<{ count: number; resetAtMs: number }>;
};

/** What the Upstash store needs from Redis: INCR, EXPIRE NX and PTTL in one round trip. Injectable for tests. */
export type RedisExec = (key: string, windowSec: number) => Promise<[number, unknown, number]>;

const KEY_PREFIX = "rl:";
const UPSTASH_TIMEOUT_MS = 800;

export function createUpstashStore(exec: RedisExec): CounterStore {
  return {
    name: "upstash",
    async hit(key, windowSec, nowMs) {
      const [count, , ttlMs] = await exec(`${KEY_PREFIX}${key}`, windowSec);
      if (!Number.isFinite(count)) throw new Error("unexpected Upstash reply");
      // A key without a TTL (-1) cannot happen with EXPIRE NX in the same pipeline; fall back to the full window.
      const remainingMs = ttlMs > 0 ? ttlMs : windowSec * 1000;
      return { count, resetAtMs: nowMs + remainingMs };
    },
  };
}

/** The real Redis pipeline. No retries (a failure must fall back at once) and a short per-request timeout. */
export function createRedisExec(config: { url: string; token: string }): RedisExec {
  const redis = new Redis({
    url: config.url,
    token: config.token,
    retry: false,
    automaticDeserialization: false,
    signal: () => AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  });
  return async (key, windowSec) => {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSec, "NX");
    pipeline.pttl(key);
    return (await pipeline.exec()) as [number, unknown, number];
  };
}

export const postgresStore: CounterStore = {
  name: "postgres",
  async hit(key, windowSec, nowMs) {
    const { count, resetAt } = await hitCounter(key, windowSec, new Date(nowMs));
    return { count, resetAtMs: resetAt.getTime() };
  },
};
