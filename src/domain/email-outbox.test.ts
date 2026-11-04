import { describe, expect, it } from "vitest";
import {
  emailPayloads,
  isExpired,
  nextAttemptAt,
  OUTBOX_MAX_ATTEMPTS,
  outboxExpiry,
} from "./email-outbox";

const now = new Date("2026-10-30T12:00:00Z");

describe("email outbox rules", () => {
  it("validates payloads: a code is exactly six digits, a reset link is http(s)", () => {
    expect(
      emailPayloads["verify-code"].safeParse({ code: "123456", expiresMinutes: 10 }).success,
    ).toBe(true);
    expect(
      emailPayloads["verify-code"].safeParse({ code: "12345", expiresMinutes: 10 }).success,
    ).toBe(false);
    expect(
      emailPayloads["verify-code"].safeParse({ code: "12345a", expiresMinutes: 10 }).success,
    ).toBe(false);
    expect(
      emailPayloads["reset-password"].safeParse({
        url: "https://shop.example/reset?token=x",
        expiresMinutes: 60,
      }).success,
    ).toBe(true);
    expect(
      emailPayloads["reset-password"].safeParse({ url: "javascript:alert(1)", expiresMinutes: 60 })
        .success,
    ).toBe(false);
  });
  it("expires a message when its code or link would", () => {
    expect(outboxExpiry("verify-code", { expiresMinutes: 10 }, now).toISOString()).toBe(
      "2026-10-30T12:10:00.000Z",
    );
    expect(outboxExpiry("reset-password", { expiresMinutes: 60 }, now).toISOString()).toBe(
      "2026-10-30T13:00:00.000Z",
    );
  });
  it("keeps a password-changed notice for a day and accepts only a device code in its payload", () => {
    expect(outboxExpiry("password-changed", {}, now).toISOString()).toBe(
      "2026-10-31T12:00:00.000Z",
    );
    const ok = { device: "chrome/windows", resetUrl: "https://shop.example/en/forgot-password" };
    expect(emailPayloads["password-changed"].safeParse(ok).success).toBe(true);
    expect(emailPayloads["password-changed"].safeParse({ ...ok, device: null }).success).toBe(true);
    expect(
      emailPayloads["password-changed"].safeParse({ ...ok, device: "Mozilla/5.0 (X11)" }).success,
    ).toBe(false);
  });
  it("backs off 1 min, 5 min, 30 min, 2 h and gives up after five attempts", () => {
    const delays = [1, 2, 3, 4].map(
      (n) => (nextAttemptAt(n, now).getTime() - now.getTime()) / 60_000,
    );
    expect(delays).toEqual([1, 5, 30, 120]);
    expect(OUTBOX_MAX_ATTEMPTS).toBe(5);
  });
  it("is expired exactly at its time", () => {
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(new Date(now.getTime() + 1), now)).toBe(false);
  });
});
