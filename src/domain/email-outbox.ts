import { z } from "zod";

/** Email outbox rules (ADR 0022): templates, payload shapes, expiry and the retry schedule. Pure. */
export const EMAIL_TEMPLATES = ["verify-code", "reset-password", "test"] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

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
  test: z.object({}),
} as const satisfies Record<EmailTemplate, z.ZodType>;

export type EmailPayload<T extends EmailTemplate> = z.infer<(typeof emailPayloads)[T]>;

/** A code or link is useless after it expires, so the outbox never sends it late. */
export function outboxExpiry(template: EmailTemplate, payload: unknown, now: Date): Date {
  const minutes =
    template === "test" ? 60 : ((payload as { expiresMinutes?: number }).expiresMinutes ?? 15);
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
