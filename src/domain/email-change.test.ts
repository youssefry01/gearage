import { describe, expect, it } from "vitest";
import {
  cancelTokenSchema,
  confirmEmailChangeSchema,
  EMAIL_REVERT_DAYS,
  revertTokenSchema,
  maskEmail,
  requestEmailChangeSchema,
} from "./email-change";
import { EMAIL_CATEGORIES, EMAIL_TEMPLATES, emailPayloads, outboxExpiry } from "./email-outbox";
import { policies } from "./rate-limit";

describe("maskEmail", () => {
  it("shows the first character and the whole domain", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***@example.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
  it("handles a first character outside the BMP and malformed input without leaking", () => {
    expect(maskEmail("😀x@example.com")).toBe("😀***@example.com");
    expect(maskEmail("no-at-sign")).toBe("***");
    expect(maskEmail("@x.com")).toBe("***");
  });
  it("always satisfies the payload schema that guards the emails", () => {
    for (const e of ["jane@example.com", "x@y.z", "long.name+tag@sub.example.co.uk"])
      expect(
        emailPayloads["email-changed"].shape.newEmailMasked.safeParse(maskEmail(e)).success,
      ).toBe(true);
  });
});

describe("email change schemas", () => {
  it("normalizes the new address and requires the current password", () => {
    const ok = requestEmailChangeSchema.parse({
      newEmail: "  New@Example.COM ",
      currentPassword: "x",
    });
    expect(ok.newEmail).toBe("new@example.com");
    expect(
      requestEmailChangeSchema.safeParse({ newEmail: "nope", currentPassword: "x" }).success,
    ).toBe(false);
    expect(
      requestEmailChangeSchema.safeParse({ newEmail: "a@b.co", currentPassword: "" }).success,
    ).toBe(false);
  });
  it("accepts a pasted code with spaces and Arabic digits", () => {
    expect(confirmEmailChangeSchema.parse({ code: "123 456" }).code).toBe("123456");
    expect(confirmEmailChangeSchema.parse({ code: "١٢٣٤٥٦" }).code).toBe("123456");
    expect(confirmEmailChangeSchema.safeParse({ code: "12345" }).success).toBe(false);
  });
  it("accepts only a 43-character base64url cancel token", () => {
    expect(cancelTokenSchema.safeParse("A".repeat(43)).success).toBe(true);
    expect(cancelTokenSchema.safeParse("A".repeat(42)).success).toBe(false);
    expect(cancelTokenSchema.safeParse("A".repeat(42) + "+").success).toBe(false);
  });
});

describe("email templates and policies", () => {
  it("every template is transactional until marketing consent can be edited (M8a)", () => {
    for (const t of EMAIL_TEMPLATES) expect(EMAIL_CATEGORIES[t], t).toBe("transactional");
  });
  it("a password-changed payload without `method` still validates (rows queued before M5b-2a)", () => {
    expect(
      emailPayloads["password-changed"].safeParse({
        device: null,
        resetUrl: "https://x.test/en/forgot-password",
      }).success,
    ).toBe(true);
  });
  it("payload URLs must be http(s)", () => {
    expect(
      emailPayloads["email-change-notice"].safeParse({
        newEmailMasked: "j***@example.com",
        cancelUrl: "javascript:alert(1)",
        device: null,
        expiresMinutes: 30,
      }).success,
    ).toBe(false);
  });
  it("security notices outlive a code (24 h) while codes expire with themselves", () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(outboxExpiry("email-changed", {}, now).getTime() - now.getTime()).toBe(24 * 3_600_000);
    expect(
      outboxExpiry("email-change-code", { expiresMinutes: 30 }, now).getTime() - now.getTime(),
    ).toBe(30 * 60_000);
  });
  it("every email-change policy fails closed", () => {
    for (const p of Object.values(policies).filter((x) => x.name.startsWith("auth.email.change")))
      expect(p.failMode, p.name).toBe("closed");
  });
});

describe("the revert window (ADR 0027)", () => {
  it("is seven days, and its link token has the same strict shape as the cancel token", () => {
    expect(EMAIL_REVERT_DAYS).toBe(7);
    expect(revertTokenSchema.safeParse("A".repeat(43)).success).toBe(true);
    expect(revertTokenSchema.safeParse("A".repeat(42)).success).toBe(false);
    expect(revertTokenSchema.safeParse("A".repeat(42) + "=").success).toBe(false);
  });

  it("its notices are transactional, outlive a day in the outbox, and the old payload (no link) still validates", () => {
    for (const t of ["email-reverted", "email-revert-released"] as const) {
      expect(EMAIL_CATEGORIES[t]).toBe("transactional");
      expect(outboxExpiry(t, {}, new Date(0)).getTime()).toBe(24 * 60 * 60_000);
    }
    expect(
      emailPayloads["email-changed"].safeParse({
        newEmailMasked: "j***@example.com",
        contactUrl: "https://shop.example/en/contact",
      }).success,
    ).toBe(true);
    expect(
      emailPayloads["email-changed"].safeParse({
        newEmailMasked: "j***@example.com",
        contactUrl: "https://shop.example/en/contact",
        revertUrl: "javascript:alert(1)",
        revertDays: 7,
      }).success,
    ).toBe(false);
  });

  it("the revert link has its own per-IP policy, fail closed", () => {
    expect(policies.emailChangeRevertIp.failMode).toBe("closed");
  });
});
