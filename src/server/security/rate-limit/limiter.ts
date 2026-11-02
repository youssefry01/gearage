import {
  isAllowed,
  retryAfterSeconds,
  type LimitResult,
  type RateLimitPolicy,
} from "@/domain/rate-limit";
import { getEnv, upstashConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { hmacHex } from "@/server/security/keys";
import { createRedisExec, createUpstashStore, postgresStore, type CounterStore } from "./stores";

export type Limiter = { hit(policy: RateLimitPolicy, subject: string): Promise<LimitResult> };

export type LimiterDeps = {
  /** Upstash, or null when it is not configured. */
  primary: CounterStore | null;
  fallback: CounterStore;
  keyFor: (policyName: string, subject: string) => string;
  now?: () => number;
  /** After the primary fails it is skipped this long, so requests do not each wait for its timeout. */
  breakerMs?: number;
  /** Multiplies every maximum (tests only; 1 in production). */
  scale?: number;
};

const UNAVAILABLE_RETRY_SEC = 30;

/**
 * The limiter chain (ADR 0021): primary store (Upstash) -> Postgres fallback -> the policy's failMode.
 * Counters of the two stores are separate, so a switch restarts the window; that is accepted. The account lockout
 * (M5a-2) lives in Postgres only and does not depend on this.
 */
export function createLimiter(deps: LimiterDeps): Limiter {
  const now = deps.now ?? Date.now;
  const breakerMs = deps.breakerMs ?? 30_000;
  const scale = deps.scale ?? 1;
  let primaryDownUntil = 0;

  async function tryStore(store: CounterStore, key: string, windowSec: number, nowMs: number) {
    try {
      return await store.hit(key, windowSec, nowMs);
    } catch (err) {
      logger.warn("rate_limit_store_failed", { store: store.name, err });
      return null;
    }
  }

  return {
    async hit(policy, subject) {
      const nowMs = now();
      const key = deps.keyFor(policy.name, subject);
      const max = policy.max * scale;

      let outcome: { count: number; resetAtMs: number } | null = null;
      if (deps.primary && nowMs >= primaryDownUntil) {
        outcome = await tryStore(deps.primary, key, policy.windowSec, nowMs);
        if (!outcome) primaryDownUntil = nowMs + breakerMs;
      }
      outcome ??= await tryStore(deps.fallback, key, policy.windowSec, nowMs);

      if (!outcome) {
        return {
          allowed: policy.failMode === "open",
          retryAfterSec: UNAVAILABLE_RETRY_SEC,
          unavailable: true,
        };
      }
      const allowed = isAllowed(outcome.count, max);
      return {
        allowed,
        retryAfterSec: allowed ? 0 : retryAfterSeconds(outcome.resetAtMs, nowMs),
        unavailable: false,
      };
    },
  };
}

/** Identifiers are stored only as keyed hashes: no IP address or email ever lands in Redis or Postgres. */
export const defaultKeyFor = (policyName: string, subject: string): string =>
  `${policyName}:${hmacHex("rate-limit", subject).slice(0, 32)}`;

let shared: Limiter | undefined;

export function getLimiter(): Limiter {
  if (shared) return shared;
  const env = getEnv();
  const upstash = upstashConfig(env);
  shared = createLimiter({
    primary: upstash ? createUpstashStore(createRedisExec(upstash)) : null,
    fallback: postgresStore,
    keyFor: defaultKeyFor,
    scale: env.RATE_LIMIT_SCALE,
  });
  return shared;
}

/** Tests only: replace (or with `undefined`, reset) the shared limiter. */
export function setLimiterForTests(limiter: Limiter | undefined): void {
  shared = limiter;
}
