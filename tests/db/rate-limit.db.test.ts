import { beforeEach, describe, expect, it } from "vitest";
import { policies, type RateLimitPolicy } from "@/domain/rate-limit";
import { hitCounter, pruneCounters } from "@/server/repositories/rate-limit.repository";
import { createLimiter } from "@/server/security/rate-limit/limiter";
import { postgresStore, type CounterStore } from "@/server/security/rate-limit/stores";
import { db, resetData } from "./helpers";

beforeEach(resetData);

const t0 = new Date("2026-10-30T12:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("postgres counter", () => {
  it("counts up inside a window and reports when it ends", async () => {
    const a = await hitCounter("k", 60, t0);
    const b = await hitCounter("k", 60, at(10_000));
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
    expect(b.resetAt.toISOString()).toBe(at(60_000).toISOString()); // the window does not slide
  });
  it("restarts at 1 once the window has ended", async () => {
    await hitCounter("k", 60, t0);
    await hitCounter("k", 60, at(1_000));
    const after = await hitCounter("k", 60, at(60_000));
    expect(after.count).toBe(1);
    expect(after.resetAt.toISOString()).toBe(at(120_000).toISOString());
  });
  it("keeps keys apart", async () => {
    await hitCounter("a", 60, t0);
    expect((await hitCounter("b", 60, t0)).count).toBe(1);
  });
  it("is atomic: 40 concurrent hits yield exactly the counts 1..40, each once", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => hitCounter("race", 60, t0)));
    expect(results.map((r) => r.count).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
  });
  it("prunes only expired rows", async () => {
    await hitCounter("old", 60, t0);
    await hitCounter("fresh", 3_600, t0);
    expect(await pruneCounters(at(120_000))).toBe(1);
    const left = await db().rateLimitCounter.findMany();
    expect(left.map((r) => r.key)).toEqual(["fresh"]);
  });
  it("rejects a zero count at the database level", async () => {
    await expect(
      db().rateLimitCounter.create({ data: { key: "bad", count: 0, expiresAt: t0 } }),
    ).rejects.toThrow(/rate_limit_counter_count_chk/);
  });
});

describe("limiter on the real Postgres store", () => {
  const policy: RateLimitPolicy = { name: "t.pg", max: 3, windowSec: 60, failMode: "closed" };
  const failing: CounterStore = {
    name: "upstash",
    async hit() {
      throw new Error("upstash unreachable");
    },
  };

  it("enforces the maximum with Upstash absent", async () => {
    const limiter = createLimiter({
      primary: null,
      fallback: postgresStore,
      keyFor: (p, s) => `${p}:${s}`,
    });
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await limiter.hit(policy, "ip")).allowed);
    expect(results).toEqual([true, true, true, false, false]);
  });
  it("keeps enforcing through Postgres when Upstash errors", async () => {
    const limiter = createLimiter({
      primary: failing,
      fallback: postgresStore,
      keyFor: (p, s) => `${p}:${s}`,
    });
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await limiter.hit(policy, "ip")).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
  it("stores only keyed hashes, never an IP or an email", async () => {
    const { defaultKeyFor } = await import("@/server/security/rate-limit/limiter");
    const limiter = createLimiter({
      primary: null,
      fallback: postgresStore,
      keyFor: defaultKeyFor,
    });
    await limiter.hit(policies.loginEmail, "victim@example.com");
    await limiter.hit(policies.loginIp, "203.0.113.9");
    const keys = (await db().rateLimitCounter.findMany()).map((r) => r.key).join(" ");
    expect(keys).not.toContain("victim");
    expect(keys).not.toContain("203.0.113");
    expect(keys).toMatch(/^auth\.login\./);
  });
});
