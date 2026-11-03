import { describe, expect, it } from "vitest";
import { PENDING_VERIFICATION_MINUTES } from "@/domain/auth";
import { decodePending, encodePending } from "./pending-token";

const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 9);
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

describe("pending verification cookie", () => {
  it("round-trips an address and holds nothing else", () => {
    const value = encodePending("mona@example.test", NOW, key);
    expect(decodePending(value, NOW + 1_000, key)).toBe("mona@example.test");
    const body = JSON.parse(Buffer.from(value.split(".")[0]!, "base64url").toString("utf8"));
    expect(Object.keys(body).sort()).toEqual(["e", "x"]);
  });

  it("expires after the pending window", () => {
    const value = encodePending("mona@example.test", NOW, key);
    const edge = NOW + PENDING_VERIFICATION_MINUTES * 60_000;
    expect(decodePending(value, edge - 1, key)).toBe("mona@example.test");
    expect(decodePending(value, edge, key)).toBeNull();
  });

  it("rejects a value signed with another key, a changed address and malformed input", () => {
    const value = encodePending("mona@example.test", NOW, key);
    expect(decodePending(value, NOW, otherKey)).toBeNull();
    const [, sig] = value.split(".");
    const forged = Buffer.from(
      JSON.stringify({ e: "victim@example.test", x: NOW + 60_000 }),
    ).toString("base64url");
    expect(decodePending(`${forged}.${sig}`, NOW, key)).toBeNull();
    for (const bad of ["", "abc", "a.b.c", ".", `${value}x`, undefined, null, "x".repeat(700)]) {
      expect(decodePending(bad, NOW, key)).toBeNull();
    }
  });
});
