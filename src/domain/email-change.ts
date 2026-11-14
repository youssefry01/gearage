import { z } from "zod";
import { CODE_MAX_ATTEMPTS, codeSchema, emailSchema } from "@/domain/auth";

/**
 * Email change with re-verification (M5b-2a, ADR 0026). Pure: no I/O, no framework. Zod messages are CODES the UI
 * translates under `Auth.errors`, exactly like the other account forms.
 */

/** A pending change lives this long: the code sent to the NEW address and the cancel link sent to the CURRENT one. */
export const EMAIL_CHANGE_MINUTES = 30;
/** Wrong codes allowed per request; after that the request is destroyed and the person starts again. */
export const EMAIL_CHANGE_MAX_ATTEMPTS = CODE_MAX_ATTEMPTS;
/**
 * After a change completes, the OLD address is reserved and a single-use revert link works for this long (ADR 0027,
 * decided 2026-11-10). After the window, recovery goes through support with identity checks.
 */
export const EMAIL_REVERT_DAYS = 7;
/** A cancel token is 32 random bytes in base64url: exactly 43 characters. */
export const CANCEL_TOKEN_LENGTH = 43;

/** The form that starts a change: the new address and the CURRENT password (a stolen session is not enough). */
export const requestEmailChangeSchema = z.object({
  newEmail: emailSchema,
  // Presence and an upper bound only: the policy applies to a password being CHOSEN, never to one being typed in.
  currentPassword: z
    .string({ error: "required" })
    .min(1, { error: "required" })
    .max(1_024, { error: "wrong_current_password" }),
});
export type RequestEmailChangeInput = z.input<typeof requestEmailChangeSchema>;

/** The form that finishes it: the 6-digit code sent to the new address. */
export const confirmEmailChangeSchema = z.object({ code: codeSchema });
export type ConfirmEmailChangeInput = z.input<typeof confirmEmailChangeSchema>;

/** The token in the cancel link (the URL fragment). Shape only; whether it is live is the database's answer. */
export const cancelTokenSchema = z
  .string({ error: "invalid_token" })
  .regex(new RegExp(`^[A-Za-z0-9_-]{${CANCEL_TOKEN_LENGTH}}$`), { error: "invalid_token" });

/** The token in the revert link: same shape as the cancel token (a different secret, stored under a different HMAC key). */
export const revertTokenSchema = cancelTokenSchema;

/**
 * `jane.doe@example.com` to `j***@example.com`: enough for the owner to recognise an address, little for anyone else.
 * The local part is never shown beyond its first character; the domain is shown whole (it is what tells the owner
 * which mailbox is meant). Input is expected to be a normalized address.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const first = Array.from(email.slice(0, at))[0] ?? "";
  return `${first}***${email.slice(at)}`;
}
