// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deriveKey, hmacHex } from "./keys";

describe("key derivation", () => {
  it("is deterministic and 32 bytes", () => {
    expect(deriveKey("a")).toEqual(deriveKey("a"));
    expect(deriveKey("a")).toHaveLength(32);
  });
  it("separates purposes and contexts (so the daily visitor key rotates)", () => {
    expect(deriveKey("a").equals(deriveKey("b"))).toBe(false);
    expect(deriveKey("v", "2026-10-30").equals(deriveKey("v", "2026-10-31"))).toBe(false);
    // "ab"+"" must not collide with "a"+"b"
    expect(deriveKey("ab", "").equals(deriveKey("a", "b"))).toBe(false);
  });
  it("depends on the secret", () => {
    expect(deriveKey("a", "", "x".repeat(32)).equals(deriveKey("a", "", "y".repeat(32)))).toBe(
      false,
    );
  });
  it("hmacHex is a stable 64-char digest that does not contain its input", () => {
    const d = hmacHex("rate-limit", "203.0.113.9");
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    expect(d).toBe(hmacHex("rate-limit", "203.0.113.9"));
    expect(d).not.toContain("203");
    expect(hmacHex("rate-limit", "203.0.113.10")).not.toBe(d);
  });
});
