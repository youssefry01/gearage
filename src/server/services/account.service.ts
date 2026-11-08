import { routes } from "@/config/routes";
import { SECURITY_EVENTS_SHOWN, SESSIONS_SHOWN, type ProfileData } from "@/domain/account";
import { parseDateOfBirth } from "@/domain/auth";
import { normalizePassword } from "@/domain/password";
import { policies } from "@/domain/rate-limit";
import type { Gender, SecurityEventType } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/locales";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import * as repo from "@/server/repositories/account.repository";
import * as authRepo from "@/server/repositories/auth.repository";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { dispatchAfterResponse } from "@/server/services/after-response";
import { enforceLimit } from "@/server/services/enforce-limit";
import { enqueueEmail } from "@/server/services/email.service";
import { assessPassword } from "@/server/services/password-policy.service";

/**
 * The signed-in person's own account (M5b-1, ADR 0025): profile, password, sessions, security activity. Called by
 * `authedAction`s, which have already proved there IS a session and passed its user id and session id here. Rules:
 *  - Every query is scoped by that user id: a session id from another account deletes nothing (no IDOR).
 *  - The session `token` (the cookie secret) never leaves the repository.
 *  - Nothing here logs a password, an email address or a device label.
 */

type Deps = { now?: () => Date };
const clock = (deps: Deps): Date => (deps.now ?? (() => new Date()))();

// --- Security log --------------------------------------------------------------------------------------------------

/** Best effort: a failure to write the log is reported and swallowed, it must never undo or block what it describes. */
export async function recordSecurityEvent(event: {
  userId: string;
  type: SecurityEventType;
  device?: string | null;
  createdAt: Date;
}): Promise<void> {
  try {
    await repo.insertSecurityEvent(event);
  } catch (err) {
    logger.error("security_event_failed", { type: event.type, err });
  }
}

/** A security event as the activity list shows it. */
export type SecurityEventView = repo.SecurityEventRow;

export async function listActivity(userId: string): Promise<SecurityEventView[]> {
  return repo.listSecurityEvents(userId, SECURITY_EVENTS_SHOWN);
}

// --- Profile -------------------------------------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<repo.Profile> {
  const profile = await repo.getProfile(userId);
  if (!profile) throw new AppError("NOT_FOUND", "Account not found");
  return profile;
}

/** Saves name, mobile, date of birth and gender. Email and consent are not editable here (ADR 0025). */
export async function updateProfile(
  userId: string,
  data: ProfileData,
  deps: Deps = {},
): Promise<{ status: "saved" }> {
  const now = clock(deps);
  let dateOfBirth: Date | null = null;
  if (data.dateOfBirth) {
    const dob = parseDateOfBirth(data.dateOfBirth, now);
    if (!dob.ok) {
      throw new AppError("VALIDATION_FAILED", "Invalid date of birth", {
        details: { field: "dateOfBirth", issue: dob.error },
      });
    }
    dateOfBirth = dob.date;
  }
  const gender: Gender | null = data.gender ? (data.gender.toUpperCase() as Gender) : null;
  const saved = await repo.updateProfile(
    userId,
    { firstName: data.firstName, lastName: data.lastName, phone: data.phone, dateOfBirth, gender },
    now,
  );
  if (!saved) throw new AppError("NOT_FOUND", "Account not found");
  return { status: "saved" };
}

// --- Password change -----------------------------------------------------------------------------------------------

export type ChangePasswordArgs = {
  userId: string;
  email: string;
  /** The session making the change: it stays signed in (decided 2026-11-04). */
  sessionId: string;
  currentPassword: string;
  newPassword: string;
  /** Page language, for the notice email. */
  locale: Locale;
  /** Coarse device label (`chrome/windows`) of this request, shown in the notice email. */
  device: string | null;
};

/**
 * Changes the password of a signed-in account. Order matters:
 *  1. a per-account limit, counted on EVERY attempt (a stolen session must not become a password-guessing oracle);
 *  2. the CURRENT password is checked first, so a wrong one never costs a breach-list lookup;
 *  3. the new password must differ from the current one and meet the policy (length, not in a known breach);
 *  4. in ONE transaction: the hash is replaced (compare-and-set against the hash that was verified), every OTHER session
 *     is deleted, the event is logged and the notice email is queued. All or nothing.
 * The current session is kept. The notice goes to the account's address after the response.
 */
export async function changePassword(
  args: ChangePasswordArgs,
  deps: Deps = {},
): Promise<{ status: "changed"; signedOutOthers: number }> {
  const now = clock(deps);
  await enforceLimit(policies.passwordChangeUser, args.userId);

  const stored = await authRepo.getCredentialHash(args.userId);
  if (!stored) {
    // Cannot happen for an account made through registration; there is nothing to change.
    throw new AppError("BAD_REQUEST", "No password on this account", {
      details: { issue: "wrong_current_password", field: "currentPassword" },
    });
  }
  const check = await verifyPassword(args.currentPassword, stored);
  if (!check.valid) {
    throw new AppError("BAD_REQUEST", "Wrong current password", {
      details: { field: "currentPassword", issue: "wrong_current_password" },
    });
  }
  if (normalizePassword(args.newPassword) === normalizePassword(args.currentPassword)) {
    throw new AppError("VALIDATION_FAILED", "The new password is the same", {
      details: { field: "newPassword", issue: "same_password" },
    });
  }
  const assessment = await assessPassword(args.newPassword);
  if (!assessment.ok) {
    throw new AppError("VALIDATION_FAILED", "Invalid password", {
      details: { field: "newPassword", issue: assessment.issue },
    });
  }

  const fresh = await hashPassword(args.newPassword); // CPU-heavy: outside the transaction
  const resetUrl = `${getEnv().APP_URL.replace(/\/+$/, "")}/${args.locale}${routes.forgotPassword}`;

  const { signedOutOthers, emailId } = await getDb().$transaction(async (tx) => {
    const replaced = await authRepo.replaceCredentialHash(args.userId, stored, fresh, now, tx);
    if (!replaced) {
      // The password changed under us (another tab, a reset): do not overwrite the newer one.
      throw new AppError("CONFLICT", "The password changed while this request ran", {
        details: { issue: "try_again" },
      });
    }
    const removed = await repo.deleteOtherSessions(args.userId, args.sessionId, tx);
    await repo.insertSecurityEvent(
      { userId: args.userId, type: "PASSWORD_CHANGED", createdAt: now },
      tx,
    );
    const id = await enqueueEmail(
      {
        template: "password-changed",
        to: args.email,
        locale: args.locale,
        payload: { device: args.device, resetUrl },
      },
      { db: tx, now },
    );
    return { signedOutOthers: removed, emailId: id };
  });
  dispatchAfterResponse([emailId]);
  return { status: "changed", signedOutOthers };
}

// --- Sessions ------------------------------------------------------------------------------------------------------

export type SessionView = {
  id: string;
  device: string | null;
  signedInAt: Date;
  /** Approximate: Better Auth refreshes it at most once a day. */
  lastActiveAt: Date;
  current: boolean;
};

/** This account's live sessions, this one first. */
export async function listSessions(
  userId: string,
  currentSessionId: string,
  deps: Deps = {},
): Promise<SessionView[]> {
  const rows = await repo.listSessions(userId, clock(deps), SESSIONS_SHOWN);
  const views = rows.map((r) => ({
    id: r.id,
    device: r.device,
    signedInAt: r.createdAt,
    lastActiveAt: r.updatedAt,
    current: r.id === currentSessionId,
  }));
  return [...views.filter((v) => v.current), ...views.filter((v) => !v.current)];
}

/** Signs one OTHER device out. The current session is signed out with the normal "Sign out", never from this list. */
export async function revokeSession(
  userId: string,
  currentSessionId: string,
  sessionId: string,
  deps: Deps = {},
): Promise<{ status: "revoked"; count: number }> {
  if (sessionId === currentSessionId) {
    throw new AppError("BAD_REQUEST", "Use Sign out for this device", {
      details: { issue: "current_session" },
    });
  }
  const now = clock(deps);
  const count = await getDb().$transaction(async (tx) => {
    const removed = await repo.deleteSession(userId, sessionId, currentSessionId, tx);
    if (removed > 0)
      await repo.insertSecurityEvent({ userId, type: "SESSION_REVOKED", createdAt: now }, tx);
    return removed;
  });
  // The count is 1 if this call signed the device out and 0 if it was already gone. An id that belongs to another
  // account also answers 0, exactly like one that never existed: it says nothing about other accounts (ADR 0026 item 9).
  return { status: "revoked", count };
}

/** "Sign out of other devices": every session of this account except the current one. */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
  deps: Deps = {},
): Promise<{ status: "revoked"; count: number }> {
  const now = clock(deps);
  const count = await getDb().$transaction(async (tx) => {
    const removed = await repo.deleteOtherSessions(userId, currentSessionId, tx);
    if (removed > 0)
      await repo.insertSecurityEvent(
        { userId, type: "OTHER_SESSIONS_REVOKED", createdAt: now },
        tx,
      );
    return removed;
  });
  return { status: "revoked", count };
}
