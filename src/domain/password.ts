import { z } from "zod";

/**
 * Password policy (ADR 0003): length only, no composition rules. Spaces and any Unicode (Arabic included) are
 * allowed. Passwords are normalized with NFKC BEFORE length checks, breach checks and hashing, so the same password
 * typed on a different keyboard or with a different Unicode composition always hashes the same way.
 * Lengths are counted in Unicode code points of the normalized text (an emoji is one, not two).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}

export function passwordLength(password: string): number {
  return Array.from(normalizePassword(password)).length;
}

export type PasswordIssue = "too_short" | "too_long" | "contains_null";

/** The first policy problem, or null. Breach checking is separate (server/security/hibp.ts, it needs the network). */
export function checkPasswordShape(password: string): PasswordIssue | null {
  if (password.includes("\u0000")) return "contains_null";
  const length = passwordLength(password);
  if (length < PASSWORD_MIN_LENGTH) return "too_short";
  if (length > PASSWORD_MAX_LENGTH) return "too_long";
  return null;
}

/** Shared by the register/reset forms and the server. Messages are issue codes; the UI maps them to translated text. */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  const issue = checkPasswordShape(value);
  if (issue) ctx.addIssue({ code: "custom", message: issue });
});
