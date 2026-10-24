import { describe, expect, it, vi } from "vitest";
import { lastGood } from "./last-good";

const clock = () => {
  let t = 1_000;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe("lastGood", () => {
  it("loads once, then serves the fresh value without loading again", async () => {
    const c = clock();
    const load = vi.fn().mockResolvedValue(["a"]);
    const cache = lastGood(load, { ttlMs: 100, retryMs: 10, fallback: [], now: c.now });
    expect(await cache.get()).toEqual({ value: ["a"], degraded: false });
    c.advance(99);
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the last good value when a refresh fails, and reports the error once", async () => {
    const c = clock();
    const onError = vi.fn();
    const load = vi.fn().mockResolvedValueOnce(["good"]).mockRejectedValue(new Error("db down"));
    const cache = lastGood(load, {
      ttlMs: 100,
      retryMs: 50,
      fallback: ["min"],
      onError,
      now: c.now,
    });
    await cache.get();
    c.advance(101);
    expect(await cache.get()).toEqual({ value: ["good"], degraded: true });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("serves the minimal fallback when it has never loaded, without throwing", async () => {
    const cache = lastGood(() => Promise.reject(new Error("boom")), {
      ttlMs: 100,
      retryMs: 50,
      fallback: ["min"],
    });
    await expect(cache.get()).resolves.toEqual({ value: ["min"], degraded: true });
  });

  it("does not hammer a failing source: no retry before retryMs, then it retries and recovers", async () => {
    const c = clock();
    const load = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(["ok"]);
    const cache = lastGood(load, { ttlMs: 100, retryMs: 50, fallback: [], now: c.now });
    await cache.get();
    c.advance(49);
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
    c.advance(1);
    expect(await cache.get()).toEqual({ value: ["ok"], degraded: false });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent callers", async () => {
    let resolve!: (v: string[]) => void;
    const load = vi.fn(() => new Promise<string[]>((r) => (resolve = r)));
    const cache = lastGood(load, { ttlMs: 100, retryMs: 50, fallback: [] });
    const both = Promise.all([cache.get(), cache.get()]);
    resolve(["a"]);
    const [x, y] = await both;
    expect(load).toHaveBeenCalledTimes(1);
    expect(x).toEqual(y);
  });

  it("survives a throwing onError", async () => {
    const cache = lastGood(() => Promise.reject(new Error("x")), {
      ttlMs: 1,
      retryMs: 1,
      fallback: [],
      onError: () => {
        throw new Error("logger broke");
      },
    });
    await expect(cache.get()).resolves.toMatchObject({ degraded: true });
  });
});
