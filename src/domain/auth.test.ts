import { describe, expect, it } from "vitest";
import {
  LOCKOUT_MAX_SECONDS,
  sanitizeCodeInput,
  PHONE_INPUT_MAX_LENGTH,
  sanitizePhoneInput,
  toLocalMobile,
  ageOn,
  codeSchema,
  emailSchema,
  loginSchema,
  lockoutDelaySeconds,
  parseDateOfBirth,
  parseEgyptianMobile,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
  toWesternDigits,
} from "./auth";

const base = {
  firstName: "Mona",
  lastName: "Hassan",
  email: "mona@example.com",
  phone: "01012345678",
  password: "correct-horse-battery-staple",
  acceptTerms: true,
};
const issues = (input: unknown) => {
  const r = registerSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("parseEgyptianMobile", () => {
  it.each([
    ["01012345678", "+201012345678"],
    ["010 1234 5678", "+201012345678"],
    ["010-1234-5678", "+201012345678"],
    ["+20 101 234 5678", "+201012345678"],
    ["0020 10 1234 5678", "+201012345678"],
    ["201012345678", "+201012345678"],
    ["01112345678", "+201112345678"],
    ["01212345678", "+201212345678"],
    ["01512345678", "+201512345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "+201012345678"], // Arabic-Indic digits
    ["۰۱۰۱۲۳۴۵۶۷۸", "+201012345678"], // Persian digits
  ])("accepts %s", (input, expected) => expect(parseEgyptianMobile(input)).toBe(expected));

  it.each([
    "",
    "abc",
    "0101234567",
    "010123456789",
    "01312345678",
    "01412345678",
    "+1 202 555 0143",
    "02 2345 6789",
    "+20 10 1234 56789",
  ])("rejects %s", (input) => expect(parseEgyptianMobile(input)).toBeNull());
});

describe("parseDateOfBirth", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  it("accepts a real adult date and returns UTC midnight", () => {
    const r = parseDateOfBirth("1990-05-17", now);
    expect(r).toEqual({ ok: true, date: new Date("1990-05-17T00:00:00Z") });
  });
  it("rejects impossible dates, bad formats, the future and absurd ages", () => {
    for (const v of ["1990-02-30", "1990-13-01", "17/05/1990", "", "2027-01-01", "1800-01-01"]) {
      expect(parseDateOfBirth(v, now)).toEqual({ ok: false, error: "invalid_dob" });
    }
  });
  it("requires 16 years, exactly on the birthday", () => {
    expect(parseDateOfBirth("2010-11-03", now)).toEqual({ ok: false, error: "too_young" });
    expect(parseDateOfBirth("2010-11-02", now).ok).toBe(true);
    expect(ageOn(new Date("2010-11-02T00:00:00Z"), now)).toBe(16);
  });
  it("accepts Arabic digits", () => {
    expect(parseDateOfBirth("١٩٩٠-٠٥-١٧", now).ok).toBe(true);
    expect(toWesternDigits("١٢٣")).toBe("123");
  });
});

describe("emailSchema", () => {
  it("trims and lower-cases", () =>
    expect(emailSchema.parse("  Mona@Example.COM ")).toBe("mona@example.com"));
  it.each(["", "no-at", "a@", "@b.com", "a b@c.com"])("rejects %j", (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a complete valid registration and normalizes email and phone", () => {
    const r = registerSchema.parse({
      ...base,
      email: " Mona@Example.com ",
      marketingConsent: undefined,
    });
    expect(r).toMatchObject({
      email: "mona@example.com",
      phone: "+201012345678",
      marketingConsent: false,
    });
  });
  it("requires accepting the terms", () => {
    expect(issues({ ...base, acceptTerms: false })).toContain("acceptTerms:must_accept");
    expect(issues({ ...base, acceptTerms: undefined })).toContain("acceptTerms:must_accept");
  });
  it("uses codes as messages, per field", () => {
    expect(issues({ ...base, firstName: "", phone: "123", email: "x" })).toEqual(
      expect.arrayContaining(["firstName:required", "phone:invalid_phone", "email:invalid_email"]),
    );
  });
  it("accepts names in Arabic and with hyphens or apostrophes, rejects digits and symbols", () => {
    expect(issues({ ...base, firstName: "منى", lastName: "عبد الرحمن" })).toEqual([]);
    expect(issues({ ...base, firstName: "Anne-Marie", lastName: "O'Brien" })).toEqual([]);
    expect(issues({ ...base, firstName: "R2D2" })).toContain("firstName:invalid_name");
    expect(issues({ ...base, lastName: "<script>" })).toContain("lastName:invalid_name");
  });
  it("treats blank optional fields as absent", () => {
    const r = registerSchema.parse({ ...base, dateOfBirth: "", gender: "" });
    expect(r.dateOfBirth).toBeUndefined();
    expect(r.gender).toBeUndefined();
  });
  it("applies the password shape rule (12 characters) but nothing about composition", () => {
    expect(issues({ ...base, password: "short" })).toContain("password:too_short");
    expect(issues({ ...base, password: "aaaaaaaaaaaa" })).toEqual([]);
  });
});

describe("loginSchema", () => {
  it("does NOT apply the password policy when signing in (old, shorter passwords must still work)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("codeSchema", () => {
  it.each([
    ["123456", "123456"],
    [" 123 456 ", "123456"],
    ["123-456", "123456"],
    ["١٢٣٤٥٦", "123456"],
  ])("accepts %j", (v, out) => expect(codeSchema.parse(v)).toBe(out));
  it.each(["12345", "1234567", "abcdef", "12 34 5a"])("rejects %j", (v) =>
    expect(codeSchema.safeParse(v).success).toBe(false),
  );
});

describe("resetPasswordSchema", () => {
  it("accepts a URL-safe token and rejects anything else", () => {
    const ok = "abcDEF0123456789abcdefgh";
    expect(
      resetPasswordSchema.safeParse({ token: ok, password: "correct-horse-battery" }).success,
    ).toBe(true);
    for (const token of [
      "",
      "short",
      "has space inside the token!!",
      "a".repeat(200),
      "<script>alert(1)</script>",
    ]) {
      expect(
        resetPasswordSchema.safeParse({ token, password: "correct-horse-battery" }).success,
      ).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  const fb = "/account";
  it("keeps same-site paths", () => {
    expect(safeNextPath("/account", fb)).toBe("/account");
    expect(safeNextPath("/en/p/rtx-4060?x=1#top", fb)).toBe("/en/p/rtx-4060?x=1#top");
  });
  it.each([
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "https://evil.example",
    "http://evil.example/x",
    "javascript:alert(1)",
    "evil.example",
    "",
    "/ok\nSet-Cookie: x=1",
    "/a\u0000b",
    "/login",
    "/en/login?next=/x",
    "/ar/register",
    "/en/verify-email",
    "/" + "a".repeat(600),
  ])("falls back for %j", (v) => expect(safeNextPath(v, fb)).toBe(fb));
  it("falls back for missing values", () => {
    expect(safeNextPath(null, fb)).toBe(fb);
    expect(safeNextPath(undefined, fb)).toBe(fb);
  });
});

describe("lockoutDelaySeconds", () => {
  it("is free for the first four failures, then 30 s, 1 m, 2 m, 5 m, 10 m, capped at 15 m", () => {
    expect([1, 2, 3, 4].map(lockoutDelaySeconds)).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8, 9].map(lockoutDelaySeconds)).toEqual([30, 60, 120, 300, 600]);
    expect(lockoutDelaySeconds(10)).toBe(LOCKOUT_MAX_SECONDS);
    expect(lockoutDelaySeconds(10_000)).toBe(15 * 60);
  });
  it("never decreases as failures grow", () => {
    let prev = 0;
    for (let n = 0; n < 40; n++) {
      const d = lockoutDelaySeconds(n);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});

describe("input sanitizers (M5a-3)", () => {
  it("sanitizeCodeInput keeps six digits and converts Arabic-Indic digits", () => {
    expect(sanitizeCodeInput("123 456")).toBe("123456");
    expect(sanitizeCodeInput(" 12-34ab56 78")).toBe("123456");
    expect(sanitizeCodeInput("١٢٣٤٥٦")).toBe("123456");
    expect(sanitizeCodeInput("abc")).toBe("");
  });
  it("sanitizePhoneInput converts digits, drops junk, keeps one leading plus and the length limit", () => {
    expect(sanitizePhoneInput("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    expect(sanitizePhoneInput("+20 101-234 5678x")).toBe("+20 101-234 5678");
    expect(sanitizePhoneInput("0+10+1")).toBe("0101");
    expect(PHONE_INPUT_MAX_LENGTH).toBe(17);
    expect(sanitizePhoneInput("1".repeat(40)).length).toBe(17);
    // The longest ordinary way to write a number still fits whole.
    expect(sanitizePhoneInput("0020 10 1234 5678")).toBe("0020 10 1234 5678");
    expect(sanitizePhoneInput("+20 101 234 5678")).toBe("+20 101 234 5678");
  });
});

describe("toLocalMobile (M5b-1)", () => {
  it("shows a stored +20 number the way people write it, and round-trips through the parser", () => {
    expect(toLocalMobile("+201012345678")).toBe("01012345678");
    expect(parseEgyptianMobile(toLocalMobile("+201512345678"))).toBe("+201512345678");
    expect(toLocalMobile("whatever")).toBe("whatever");
  });
});
