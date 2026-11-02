import { describe, expect, it } from "vitest";
import { isAllowed, policies, retryAfterSeconds } from "./rate-limit";

describe("rate-limit domain", () => {
  it("allows up to the maximum, including the maximum-th hit", () => {
    expect(isAllowed(1, 3)).toBe(true);
    expect(isAllowed(3, 3)).toBe(true);
    expect(isAllowed(4, 3)).toBe(false);
  });
  it("tells the client to wait at least one second, rounded up", () => {
    expect(retryAfterSeconds(10_000, 10_000)).toBe(1);
    expect(retryAfterSeconds(10_001, 10_000)).toBe(1);
    expect(retryAfterSeconds(12_500, 10_000)).toBe(3);
    expect(retryAfterSeconds(5_000, 10_000)).toBe(1);
  });
  it("has unique policy names, sane windows, and fail-closed for every auth policy", () => {
    const all = Object.values(policies);
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
    for (const p of all) {
      expect(p.max).toBeGreaterThanOrEqual(1);
      expect(p.windowSec).toBeGreaterThanOrEqual(1);
      if (p.name.startsWith("auth.")) expect(p.failMode).toBe("closed");
      else expect(p.failMode).toBe("open");
    }
  });
});
