import { z } from "zod";
import { blankToUndefined, personName, phoneSchema } from "@/domain/auth";
import { passwordSchema } from "@/domain/password";

/**
 * Account-area rules (M5b-1, ADR 0025). Pure: no I/O, no framework. Zod messages are CODES the UI translates under
 * `Auth.errors`, exactly like the sign-in forms.
 */

/** Security events older than this are deleted by the daily `prune-auth-data` job ("about 12 months", decided 2026-11-04). */
export const SECURITY_EVENT_RETENTION_DAYS = 365;
/** How many of the newest events the activity list shows. */
export const SECURITY_EVENTS_SHOWN = 20;
/** The sessions list never shows more than this many; a person with more can use "Sign out of other devices". */
export const SESSIONS_SHOWN = 50;

export const SECURITY_EVENT_TYPES = [
  "SIGN_IN",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "SESSION_REVOKED",
  "OTHER_SESSIONS_REVOKED",
] as const;
export type SecurityEventKind = (typeof SECURITY_EVENT_TYPES)[number];

// --- Profile ------------------------------------------------------------------------------------------------------
/**
 * What the profile form sends. Email is not here (changing it needs re-verification, M5b-2) and neither is marketing
 * consent (it moves with the notification preferences, M8a). An empty optional field means "clear it".
 */
export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: phoneSchema,
  dateOfBirth: z.preprocess(
    blankToUndefined,
    z.string().max(10, { error: "invalid_dob" }).optional(),
  ),
  gender: z.preprocess(
    blankToUndefined,
    z.enum(["male", "female"], { error: "invalid_gender" }).optional(),
  ),
});
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

// --- Password change ----------------------------------------------------------------------------------------------
export const changePasswordSchema = z.object({
  // Presence and an upper bound only: the policy applies to the password being CHOSEN, never to the one being typed in.
  currentPassword: z
    .string({ error: "required" })
    .min(1, { error: "required" })
    .max(1_024, { error: "wrong_current_password" }),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

// --- Sessions -----------------------------------------------------------------------------------------------------
export const sessionIdSchema = z.object({ sessionId: z.uuid({ error: "invalid_session" }) });
