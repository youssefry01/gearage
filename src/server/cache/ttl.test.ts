import { describe, expect, it, vi } from "vitest";
import { ttlCache } from "./ttl";

describe("ttlCache", () => {
  it("shares one load between concurrent callers and serves from cache until the TTL passes", async () => {
    let loads = 0;
    let clock = 0;
    const load = vi.fn(async () => ++loads * 10);
    const cache = ttlCache(load, 1000, () => clock);
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    expect([a, b]).toEqual([10, 10]);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 999;
    expect(await cache.get()).toBe(10);
    clock = 1000;
    expect(await cache.get()).toBe(20);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("ok");
    const cache = ttlCache(load, 1000);
    await expect(cache.get()).rejects.toThrow("db down");
    expect(await cache.get()).toBe("ok");
  });

  it("clear() forces a reload", async () => {
    const load = vi.fn(async () => 1);
    const cache = ttlCache(load, 60_000);
    await cache.get();
    cache.clear();
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
