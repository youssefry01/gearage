// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createUpstashStore, type RedisExec } from "./stores";

describe("upstash store", () => {
  it("prefixes the key, passes the window, and derives the reset time from PTTL", async () => {
    const exec = vi.fn<RedisExec>(async () => [3, 0, 42_000]);
    const store = createUpstashStore(exec);
    expect(await store.hit("search.suggest:abc", 60, 1_000)).toEqual({
      count: 3,
      resetAtMs: 43_000,
    });
    expect(exec).toHaveBeenCalledWith("rl:search.suggest:abc", 60);
  });
  it("uses the whole window when Redis reports no TTL", async () => {
    const store = createUpstashStore(async () => [1, 1, -1]);
    expect(await store.hit("k", 60, 0)).toEqual({ count: 1, resetAtMs: 60_000 });
  });
  it("throws on a nonsense reply so the limiter falls back", async () => {
    const store = createUpstashStore(async () => ["x" as unknown as number, 0, 0]);
    await expect(store.hit("k", 60, 0)).rejects.toThrow();
  });
  it("propagates network errors so the limiter falls back", async () => {
    const store = createUpstashStore(async () => {
      throw new Error("timeout");
    });
    await expect(store.hit("k", 60, 0)).rejects.toThrow("timeout");
  });
});
