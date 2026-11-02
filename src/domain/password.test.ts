import { describe, expect, it } from "vitest";
import { checkPasswordShape, normalizePassword, passwordLength, passwordSchema } from "./password";

describe("password policy", () => {
  it("accepts 12 to 128 characters with no composition rules", () => {
    expect(checkPasswordShape("aaaaaaaaaaaa")).toBeNull();
    expect(checkPasswordShape("a".repeat(128))).toBeNull();
  });
  it("rejects too short and too long, counting code points after NFKC", () => {
    expect(checkPasswordShape("a".repeat(11))).toBe("too_short");
    expect(checkPasswordShape("a".repeat(129))).toBe("too_long");
    expect(passwordLength("😀".repeat(12))).toBe(12);
  });
  it("allows spaces and Arabic", () => {
    expect(checkPasswordShape("كلمة مرور طويلة جدا")).toBeNull();
    expect(checkPasswordShape("correct horse battery staple")).toBeNull();
  });
  it("rejects a NUL byte", () => {
    expect(checkPasswordShape("a".repeat(12) + "\u0000")).toBe("contains_null");
  });
  it("normalizes with NFKC so equivalent spellings are one password", () => {
    expect(normalizePassword("e\u0301")).toBe("\u00e9"); // composed vs decomposed
    expect(normalizePassword("ｐａｓｓ")).toBe("pass"); // full-width Latin
    expect(normalizePassword("\u0661\u0662\u0663")).toBe("\u0661\u0662\u0663"); // Arabic-Indic digits stay as typed
  });
  it("counts the length AFTER normalization", () => {
    expect(checkPasswordShape("ｐａｓｓｗｏｒｄ１２３")).toBe("too_short"); // 11 characters once normalized
  });
  it("exposes the same rule as a Zod schema with the issue code as message", () => {
    const bad = passwordSchema.safeParse("short");
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("too_short");
    expect(passwordSchema.safeParse("a long enough pass").success).toBe(true);
  });
});
