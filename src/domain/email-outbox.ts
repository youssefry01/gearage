import { z } from "zod";

/** Email outbox rules (ADR 0022): templates, payload shapes, expiry and the retry schedule. Pure. */
export const EMAIL_TEMPLATES = [
  "verify-code",
  "reset-password",
  "account-exists",
  "password-changed",
  "email-change-code",
  "email-change-notice",
  "email-changed",
  "email-change-taken",
  "test",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/**
 * Every template is TRANSACTIONAL: sent because of something the account holder did or that happened to the account.
 * No marketing email may be sent before marketing consent can be edited and withdrawn (M8a; decided 2026-11-05), and
 * every marketing email needs an unsubscribe link. A test fails if a template is declared "marketing" before then;
 * adding the first one means building consent editing, the unsubscribe link and that test's replacement together.
 */
export const EMAIL_CATEGORIES = {
  "verify-code": "transactional",
  "reset-password": "transactional",
  "account-exists": "transactional",
  "password-changed": "transactional",
  "email-change-code": "transactional",
  "email-change-notice": "transactional",
  "email-changed": "transactional",
  "email-change-taken": "transactional",
  test: "transactional",
} as const satisfies Record<EmailTemplate, "transactional" | "marketing">;

/** `https://shop.test/en/path#token=...` and the like: http(s) only, so a payload can never carry another scheme. */
const httpUrl = z.url({ protocol: /^https?$/ });
const deviceCode = z
  .string()
  .regex(/^[a-z0-9-]{1,24}\/[a-z0-9-]{1,24}$/)
  .nullable();
/** An address as shown to the OTHER mailbox: `j***@example.com` (see `maskEmail`). Never a full address. */
const maskedEmail = z
  .string()
  .min(4)
  .max(260)
  .regex(/^[^\s@*]\*\*\*@[^\s@]+$/u);

export const emailPayloads = {
  "verify-code": z.object({
    code: z.string().regex(/^\d{6}$/),
    expiresMinutes: z.number().int().min(1).max(60),
  }),
  "reset-password": z.object({
    url: z.url({ protocol: /^https?$/ }),
    expiresMinutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
  }),
  "account-exists": z.object({}),
  // The coarse device label ("chrome/windows") of the session that changed the password, and where to reset it if that
  // was not the owner. No address, no IP, no time (the email arrives within seconds of the change).
  "password-changed": z.object({
    device: deviceCode,
    resetUrl: httpUrl,
    /**
     * How it changed: "change" (signed in, other devices signed out) or "reset" (by the emailed link, every device signed
     * out). Absent means "change", so a row queued before this field existed still renders.
     */
    method: z.enum(["change", "reset"]).optional(),
  }),
  // To the NEW address: the 6-digit code that proves the person controls it (M5b-2a, ADR 0026).
  "email-change-code": z.object({
    code: z.string().regex(/^\d{6}$/),
    expiresMinutes: z.number().int().min(1).max(60),
  }),
  // To the CURRENT address when a change is requested: where it is going, from which device, and the cancel link.
  "email-change-notice": z.object({
    newEmailMasked: maskedEmail,
    cancelUrl: httpUrl,
    device: deviceCode,
    expiresMinutes: z.number().int().min(1).max(120),
  }),
  // To the OLD address once the change took effect.
  "email-changed": z.object({ newEmailMasked: maskedEmail, contactUrl: httpUrl }),
  // To an address that already has an account, when someone asks to move another account to it. Reveals nothing but
  // that THIS inbox's own account exists, which the inbox owner is entitled to know (same rule as "account-exists").
  "email-change-taken": z.object({}),
  test: z.object({}),
} as const satisfies Record<EmailTemplate, z.ZodType>;

export type EmailPayload<T extends EmailTemplate> = z.infer<(typeof emailPayloads)[T]>;

/** A code or link is useless after it expires, so the outbox never sends it late. */
export function outboxExpiry(template: EmailTemplate, payload: unknown, now: Date): Date {
  // A security notice stays useful for a day (a delayed "your password was changed" is still worth reading); a code or
  // link is useless after it expires.
  const minutes =
    template === "password-changed" || template === "email-changed"
      ? 24 * 60
      : template === "test" || template === "account-exists" || template === "email-change-taken"
        ? 60
        : ((payload as { expiresMinutes?: number }).expiresMinutes ?? 15);
  return new Date(now.getTime() + minutes * 60_000);
}

export const OUTBOX_MAX_ATTEMPTS = 5;
/** Delay before attempt N+1 after N failures: 1 min, 5 min, 30 min, 2 h. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export function nextAttemptAt(failedAttempts: number, now: Date): Date {
  const delay = BACKOFF_MS[Math.min(failedAttempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0];
  return new Date(now.getTime() + delay);
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Sent, failed and expired rows are deleted after this long. */
export const OUTBOX_RETENTION_DAYS = 7;
