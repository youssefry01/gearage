import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "./session-cookie";

describe("hasSessionCookie", () => {
  it("sees the session cookie, with or without the https prefix, among other cookies", () => {
    expect(hasSessionCookie("auth.session_token=abc.def")).toBe(true);
    expect(hasSessionCookie("__Secure-auth.session_token=abc.def")).toBe(true);
    expect(hasSessionCookie("consent=1; auth.session_token=abc.def; theme=dark")).toBe(true);
  });

  it("does not take look-alikes, empty values or other cookies for one", () => {
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie("consent=1; theme=dark")).toBe(false);
    expect(hasSessionCookie("auth.session_token=")).toBe(false);
    expect(hasSessionCookie("x_auth.session_token=abc")).toBe(false);
    expect(hasSessionCookie("auth.session_data=abc")).toBe(false);
  });
});
