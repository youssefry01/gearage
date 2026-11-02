// @vitest-environment node
import { describe, expect, it } from "vitest";
import { policies, type RateLimitPolicy } from "@/domain/rate-limit";
import { createLimiter } from "./limiter";
import type { CounterStore } from "./stores";

/** A real fixed-window counter in memory, with a switch to make it fail. */
function memoryStore(name: "upstash" | "postgres") {
  const rows = new Map<string, { count: number; resetAtMs: number }>();
  const state = { failing: false, calls: 0 };
  const store: CounterStore = {
    name,
    async hit(key, windowSec, nowMs) {
      state.calls++;
      if (state.failing) throw new Error(`${name} down`);
      const row = rows.get(key);
      if (!row || row.resetAtMs <= nowMs) {
        const fresh = { count: 1, resetAtMs: nowMs + windowSec * 1000 };
        rows.set(key, fresh);
        return fresh;
      }
      row.count++;
      return { ...row };
    },
  };
  return { store, state };
}

const keyFor = (p: string, s: string) => `${p}:${s}`;
const open: RateLimitPolicy = { name: "t.open", max: 2, windowSec: 60, failMode: "open" };
const closed: RateLimitPolicy = { name: "t.closed", max: 2, windowSec: 60, failMode: "closed" };

function setup(opts: { withPrimary?: boolean; scale?: number } = {}) {
  const primary = memoryStore("upstash");
  const fallback = memoryStore("postgres");
  let now = 1_000_000;
  const limiter = createLimiter({
    primary: opts.withPrimary === false ? null : primary.store,
    fallback: fallback.store,
    keyFor,
    now: () => now,
    breakerMs: 30_000,
    ...(opts.scale ? { scale: opts.scale } : {}),
  });
  return { limiter, primary, fallback, advance: (ms: number) => (now += ms) };
}

describe("limiter", () => {
  it("allows up to max, then blocks with a retry-after", async () => {
    const { limiter } = setup();
    expect((await limiter.hit(open, "ip")).allowed).toBe(true);
    expect((await limiter.hit(open, "ip")).allowed).toBe(true);
    const third = await limiter.hit(open, "ip");
    expect(third).toMatchObject({ allowed: false, unavailable: false });
    expect(third.retryAfterSec).toBe(60);
  });
  it("counts subjects and policies separately", async () => {
    const { limiter } = setup();
    await limiter.hit(open, "a");
    await limiter.hit(open, "a");
    expect((await limiter.hit(open, "b")).allowed).toBe(true);
    expect((await limiter.hit(closed, "a")).allowed).toBe(true);
  });
  it("starts a new window after it ends", async () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) await limiter.hit(open, "ip");
    advance(60_001);
    expect((await limiter.hit(open, "ip")).allowed).toBe(true);
  });
  it("uses only the Postgres store when Upstash is not configured", async () => {
    const { limiter, fallback } = setup({ withPrimary: false });
    await limiter.hit(open, "ip");
    expect(fallback.state.calls).toBe(1);
  });
  it("falls back to Postgres when Upstash errors, and keeps enforcing", async () => {
    const { limiter, primary, fallback } = setup();
    primary.state.failing = true;
    expect((await limiter.hit(closed, "ip")).allowed).toBe(true);
    expect((await limiter.hit(closed, "ip")).allowed).toBe(true);
    expect((await limiter.hit(closed, "ip")).allowed).toBe(false);
    expect(fallback.state.calls).toBe(3);
  });
  it("skips the failed primary for the breaker period, then tries it again", async () => {
    const { limiter, primary, advance } = setup();
    primary.state.failing = true;
    await limiter.hit(open, "ip");
    await limiter.hit(open, "ip");
    expect(primary.state.calls).toBe(1); // second request did not wait for the broken store
    advance(30_001);
    primary.state.failing = false;
    await limiter.hit(open, "other");
    expect(primary.state.calls).toBe(2);
  });
  it("FAIL OPEN when both stores are down: the request is allowed and flagged unavailable", async () => {
    const { limiter, primary, fallback } = setup();
    primary.state.failing = true;
    fallback.state.failing = true;
    expect(await limiter.hit(open, "ip")).toMatchObject({ allowed: true, unavailable: true });
  });
  it("FAIL CLOSED when both stores are down: the request is refused", async () => {
    const { limiter, primary, fallback } = setup();
    primary.state.failing = true;
    fallback.state.failing = true;
    const r = await limiter.hit(closed, "ip");
    expect(r).toMatchObject({ allowed: false, unavailable: true });
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });
  it("scales every maximum (test setups only)", async () => {
    const { limiter } = setup({ scale: 10 });
    for (let i = 0; i < 20; i++) expect((await limiter.hit(open, "ip")).allowed).toBe(true);
    expect((await limiter.hit(open, "ip")).allowed).toBe(false);
  });
  it("every auth policy is configured to fail closed", () => {
    for (const p of Object.values(policies).filter((x) => x.name.startsWith("auth."))) {
      expect(p.failMode).toBe("closed");
    }
  });
});
