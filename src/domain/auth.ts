import { z } from "zod";
import { passwordSchema } from "@/domain/password";

/**
 * Authentication rules (M5a-2, ADR 0002 and 0024). Pure: no I/O, no framework. Zod messages are CODES (for example
 * `invalid_email`); the UI maps them to translated text under `Auth.errors`, so one schema serves the form and the server.
 */

// --- Timings -------------------------------------------------------------------------------------------------------
export const CODE_LENGTH = 6;
/** An emailed verification code is valid this long (the email says the same number). */
export const CODE_EXPIRES_MINUTES = 10;
/** Wrong guesses allowed per issued code; after that the code is destroyed and a new one must be requested. */
export const CODE_MAX_ATTEMPTS = 5;
export const RESET_EXPIRES_MINUTES = 60;
/** An account whose email is still unverified after this many days is deleted by the daily prune job. */
export const UNVERIFIED_ACCOUNT_DAYS = 7;
/** A session lasts 7 days and is extended (at most once a day) while it is used. */
export const SESSION_DAYS = 7;
/** Responses of flows that differ by "this email exists" take at least this long (ADR 0003, ADR 0024). */
export const ENUMERATION_FLOOR_MS = 1_200;

// --- Consent -------------------------------------------------------------------------------------------------------
/**
 * Versions of the texts the shopper accepts. The legal pages are DRAFTS until the legal review (HANDOFF launch blocker 4);
 * when the reviewed text replaces them, change these strings so the record shows which text each account accepted.
 */
export const CONSENT_VERSIONS = { terms: "draft-2026-11", privacy: "draft-2026-11" } as const;

// --- Email ---------------------------------------------------------------------------------------------------------
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .max(254, { error: "invalid_email" })
  .pipe(z.email({ error: "invalid_email" }))
  .transform(normalizeEmail);

// --- Egyptian mobile numbers ---------------------------------------------------------------------------------------
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9; shoppers type either on an Arabic keyboard. */
export function toWesternDigits(value: string): string {
  return Array.from(value)
    .map((ch) => {
      const a = ARABIC_INDIC.indexOf(ch);
      if (a >= 0) return String(a);
      const b = EXTENDED_ARABIC_INDIC.indexOf(ch);
      return b >= 0 ? String(b) : ch;
    })
    .join("");
}

/**
 * Egyptian mobile numbers are `+20` then 10 digits: `1` followed by 0, 1, 2 or 5 (the 010, 011, 012 and 015 ranges) and
 * eight more digits. Accepts `01012345678`, `+20 101 234 5678`, `0020 10 1234 5678`, `201012345678` and Arabic digits.
 * Returns E.164 (`+201012345678`) or null. Whether the number exists is not checked (nothing is sent to it).
 * The prefixes are from the author's knowledge of Egypt's numbering plan; verify before launch (HANDOFF issue 80).
 */
export function parseEgyptianMobile(input: string): string | null {
  const compact = toWesternDigits(input).replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^1[0125]\d{8}$/.test(digits) ? `+20${digits}` : null;
}

export const phoneSchema = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .max(32, { error: "invalid_phone" })
  .transform((value, ctx) => {
    const parsed = parseEgyptianMobile(value);
    if (!parsed) ctx.addIssue({ code: "custom", message: "invalid_phone" });
    return parsed ?? value;
  });

// --- Date of birth (optional) --------------------------------------------------------------------------------------
/** Youngest age that may open an account. A legal question (Personal Data Protection Law 151/2020): confirm in review. */
export const MIN_AGE_YEARS = 16;
const MAX_AGE_YEARS = 120;

/** `YYYY-MM-DD` to a UTC-midnight Date, or a code. Real calendar dates only, never in the future, within the age bounds. */
export function parseDateOfBirth(
  value: string,
  now: Date,
): { ok: true; date: Date } | { ok: false; error: "invalid_dob" | "too_young" } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toWesternDigits(value.trim()));
  if (!m) return { ok: false, error: "invalid_dob" };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return { ok: false, error: "invalid_dob" };
  }
  if (date.getTime() > now.getTime()) return { ok: false, error: "invalid_dob" };
  const age = ageOn(date, now);
  if (age > MAX_AGE_YEARS) return { ok: false, error: "invalid_dob" };
  if (age < MIN_AGE_YEARS) return { ok: false, error: "too_young" };
  return { ok: true, date };
}

export function ageOn(birth: Date, now: Date): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// --- Forms ---------------------------------------------------------------------------------------------------------
const personName = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .max(60, { error: "too_long" })
  // No control characters; letters, marks, spaces, apostrophes, hyphens and dots cover names in Arabic and Latin script.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u, { error: "invalid_name" });

/** An empty optional field arrives as "" from a form; treat it as absent. */
const blankToUndefined = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const registerSchema = z.object({
  firstName: personName,
  lastName: personName,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  dateOfBirth: z.preprocess(
    blankToUndefined,
    z.string().max(10, { error: "invalid_dob" }).optional(),
  ),
  gender: z.preprocess(
    blankToUndefined,
    z.enum(["male", "female"], { error: "invalid_gender" }).optional(),
  ),
  marketingConsent: z.boolean().default(false),
  acceptTerms: z.literal(true, { error: "must_accept" }),
});
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Presence and an upper bound only: the policy applies when a password is CHOSEN, never when one is typed in.
  password: z
    .string({ error: "required" })
    .min(1, { error: "required" })
    .max(1_024, { error: "invalid_credentials" }),
});
export type LoginInput = z.input<typeof loginSchema>;

export const codeSchema = z
  .string({ error: "required" })
  .transform((v) => toWesternDigits(v).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), { error: "invalid_code" }));

export const verifyEmailSchema = z.object({ email: emailSchema, code: codeSchema });
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

export const resendCodeSchema = z.object({ email: emailSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

/** A reset token is the opaque string from the emailed link (24 URL-safe characters). */
export const resetTokenSchema = z
  .string({ error: "invalid_token" })
  .regex(/^[A-Za-z0-9_-]{16,128}$/, { error: "invalid_token" });

export const resetPasswordSchema = z.object({ token: resetTokenSchema, password: passwordSchema });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

// --- Redirect safety -----------------------------------------------------------------------------------------------
/**
 * The `next` parameter says where to go after signing in. Only a same-site path is accepted: it must start with a single
 * `/`, so `//evil.example`, `/\evil.example`, `https://evil.example`, `javascript:` and control characters all fall back.
 * The locale prefix is stripped by the caller's router, so a bare `/account` and `/en/account` are both fine.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  // Never bounce back into the auth pages themselves.
  if (
    /^\/(?:[a-z]{2}\/)?(?:login|register|verify-email|forgot-password|reset-password)(?:[/?#]|$)/.test(
      next,
    )
  ) {
    return fallback;
  }
  return next;
}

// --- Progressive lockout (ADR 0024) --------------------------------------------------------------------------------
/** Consecutive failures after which the delays start. */
export const LOCKOUT_FREE_FAILURES = 4;
export const LOCKOUT_MAX_SECONDS = 15 * 60;
/** A failure older than this no longer counts toward the next delay. */
export const LOCKOUT_DECAY_SECONDS = 60 * 60;
const LOCKOUT_STEPS_SECONDS = [30, 60, 120, 300, 600] as const;

/**
 * Delay (seconds) imposed after the Nth consecutive failed sign-in: none for the first four, then 30 s, 1 min, 2 min,
 * 5 min, 10 min and 15 min from the tenth on. Capped at 15 minutes so the lockout can never keep a real owner out for
 * long; a successful sign-in or a password reset clears it.
 */
export function lockoutDelaySeconds(failures: number): number {
  if (failures <= LOCKOUT_FREE_FAILURES) return 0;
  const step = failures - LOCKOUT_FREE_FAILURES - 1;
  return LOCKOUT_STEPS_SECONDS[step] ?? LOCKOUT_MAX_SECONDS;
}
