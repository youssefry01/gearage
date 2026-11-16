import { describe, expect, it } from "vitest";
import { accountStateFor, initialOf, isAuthArea, parseAccountState } from "./account-state";

describe("account state for the header", () => {
  it("is signed out without a name and carries only the first name and an initial otherwise", () => {
    expect(accountStateFor(null)).toEqual({ signedIn: false });
    expect(accountStateFor("  Mona ")).toEqual({ signedIn: true, name: "Mona", initial: "M" });
  });

  it("takes a whole character as the initial (Arabic, lowercase, surrogate pairs, empty)", () => {
    expect(initialOf("منى")).toBe("م");
    expect(initialOf("salma")).toBe("S");
    expect(initialOf("😀 smile")).toBe("😀");
    expect(initialOf("   ")).toBe("?");
  });

  it("parses the endpoint's envelope and refuses anything else", () => {
    expect(parseAccountState({ ok: true, data: { signedIn: false } })).toEqual({ signedIn: false });
    expect(
      parseAccountState({ ok: true, data: { signedIn: true, name: "Mona", initial: "M" } }),
    ).toEqual({ signedIn: true, name: "Mona", initial: "M" });
    for (const bad of [
      null,
      "x",
      {},
      { ok: false, error: { code: "RATE_LIMITED", message: "x" } },
      { ok: true, data: { signedIn: true } },
      { ok: true, data: { signedIn: "yes" } },
    ]) {
      expect(parseAccountState(bad)).toBeNull();
    }
  });

  it("knows which pages start or end a session", () => {
    for (const p of [
      "/login",
      "/register",
      "/verify-email",
      "/account",
      "/account/security",
      "/email-change/revert",
    ])
      expect(isAuthArea(p)).toBe(true);
    for (const p of ["/", "/cart", "/c/components", "/accounting", "/account-fake", "/search"])
      expect(isAuthArea(p)).toBe(false);
  });
});
