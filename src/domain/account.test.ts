import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  profileSchema,
  SECURITY_EVENT_RETENTION_DAYS,
  sessionIdSchema,
} from "./account";

const valid = { firstName: "Mona", lastName: "Hassan", phone: "010 1234 5678" };

describe("profileSchema", () => {
  it("normalizes the phone and treats blank optional fields as absent (they clear the stored value)", () => {
    const r = profileSchema.parse({ ...valid, dateOfBirth: "", gender: "" });
    expect(r.phone).toBe("+201012345678");
    expect(r.dateOfBirth).toBeUndefined();
    expect(r.gender).toBeUndefined();
  });
  it("accepts Arabic names and digits", () => {
    expect(
      profileSchema.parse({ firstName: "منى", lastName: "حسن", phone: "٠١٠١٢٣٤٥٦٧٨" }).phone,
    ).toBe("+201012345678");
  });
  it("reports codes, not sentences", () => {
    const r = profileSchema.safeParse({ ...valid, phone: "12345", firstName: "", gender: "x" });
    expect(r.success).toBe(false);
    const codes = r.error?.issues.map((i) => i.message);
    expect(codes).toEqual(expect.arrayContaining(["invalid_phone", "required", "invalid_gender"]));
  });
  it("has no email or consent fields: those do not change here", () => {
    const parsed = profileSchema.parse({ ...valid, email: "x@y.test", marketingConsent: true });
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("marketingConsent");
  });
});

describe("changePasswordSchema", () => {
  it("applies the password policy to the NEW password only", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "short" }).success,
    ).toBe(false);
    // Any language and spaces, no composition rules.
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "a",
        newPassword: "كلمة مرور طويلة جدًا وآمنة",
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "aaaaaaaaaaaa" })
        .success,
    ).toBe(true);
  });
  it("requires the current password but never judges it", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "", newPassword: "a".repeat(12) }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "a".repeat(12) }).success,
    ).toBe(true);
  });
});

describe("sessionIdSchema and retention", () => {
  it("accepts a UUID (v4 and v7) and nothing else", () => {
    expect(
      sessionIdSchema.safeParse({ sessionId: "0190f3b2-6b1c-7a4e-8f3d-2a5c9e1b7d40" }).success,
    ).toBe(true);
    expect(sessionIdSchema.safeParse({ sessionId: crypto.randomUUID() }).success).toBe(true);
    expect(sessionIdSchema.safeParse({ sessionId: "1 OR 1=1" }).success).toBe(false);
    expect(sessionIdSchema.safeParse({}).success).toBe(false);
  });
  it("keeps security events for about twelve months", () => {
    expect(SECURITY_EVENT_RETENTION_DAYS).toBe(365);
  });
});
