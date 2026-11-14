import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { accountRoutes, routes } from "@/config/routes";
import { ENUMERATION_FLOOR_MS } from "@/domain/auth";
import {
  EMAIL_CHANGE_MAX_ATTEMPTS,
  EMAIL_CHANGE_MINUTES,
  EMAIL_REVERT_DAYS,
  maskEmail,
} from "@/domain/email-change";
import { policies } from "@/domain/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import { defaultLocale, locales, type Locale } from "@/i18n/locales";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getAuth, resetRedirectUrl } from "@/server/auth/auth";
import { runWithAuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import * as accountRepo from "@/server/repositories/account.repository";
import * as authRepo from "@/server/repositories/auth.repository";
import * as repo from "@/server/repositories/email-change.repository";
import { hmacHex } from "@/server/security/keys";
import { hashPassword, passwordConfigFromEnv, verifyPassword } from "@/server/security/password";
import { withMinimumDuration } from "@/server/security/timing";
import { dispatchAfterResponse } from "@/server/services/after-response";
import { recordSecurityEvent } from "@/server/services/account.service";
import { enforceLimit } from "@/server/services/enforce-limit";
import { enqueueEmail } from "@/server/services/email.service";

/**
 * Changing the email address of a signed-in account (M5b-2a, ADR 0026). Called by `authedAction`s (and, for the cancel
 * link, by one public action), which have already proved the session and applied the per-IP policy. Rules:
 *  - The CURRENT password is required to start (a stolen session alone is not enough) and every attempt is counted.
 *  - A code goes to the NEW address; the CURRENT address is told, with a link that cancels the request.
 *  - Whether the new address already has an account is NEVER revealed: both cases create the same request row, queue
 *    the same number of emails, take the same time and answer the same words. The owner of a taken address is told
 *    by email instead ("email-change-taken").
 *  - Confirming moves the address, signs out every other device, removes any reset link issued to the old address,
 *    logs the event and tells the old address, all in one transaction.
 *  - The code and the cancel token are stored only as HMACs.
 *  - Nothing here logs a password, a code, a token or an address.
 *  - A completed change leaves a REVERT (ADR 0027): the old address is reserved for EMAIL_REVERT_DAYS and a single-use
 *    link sent to it restores it, signs every device out and makes the stored password unusable (a reset is required).
 *    A reserved address counts as taken for every other account, so it follows the ordinary "taken" path everywhere.
 *  - Cancelling a pending change (the link to the CURRENT address) also signs out every device and emails a reset link.
 */

type Deps = { now?: () => Date };
const clock = (deps: Deps): Date => (deps.now ?? (() => new Date()))();

const base = (): string => getEnv().APP_URL.replace(/\/+$/, "");

// --- Secrets ---------------------------------------------------------------------------------------------------------

/** Six digits from a CSPRNG, zero-padded (000000 is a valid code). */
function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 32 random bytes as base64url: 43 characters, 256 bits. */
function newCancelToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The code is bound to the account and the new address, so it cannot be replayed against another request. */
export function hashCode(userId: string, newEmail: string, code: string): string {
  return hmacHex("email-change-code", `${newEmail}\n${code}`, userId);
}

export function hashCancelToken(token: string): string {
  return hmacHex("email-change-cancel", token);
}

/** A different HMAC key from the cancel token: one secret can never stand in for the other. */
export function hashRevertToken(token: string): string {
  return hmacHex("email-change-revert", token);
}

const localeOf = (value: string): Locale =>
  (locales as readonly string[]).includes(value) ? (value as Locale) : defaultLocale;

/** Thrown inside the confirming transaction when the address is reserved for another account. Handled like P2002. */
class AddressUnavailable extends Error {}

/**
 * Emails a password-reset link to `email` through the ordinary Better Auth flow (the same email "Forgot password"
 * sends). Best effort and after the fact: the cancel or revert it follows has already succeeded.
 */
async function queueResetLink(email: string, locale: Locale): Promise<string[]> {
  try {
    const { queuedEmailIds } = await runWithAuthContext(locale, () =>
      getAuth().api.requestPasswordReset({ body: { email, redirectTo: resetRedirectUrl(locale) } }),
    );
    return queuedEmailIds;
  } catch (err) {
    logger.error("email_change_reset_link_failed", { err });
    return [];
  }
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// --- What the page shows ---------------------------------------------------------------------------------------------

export type PendingEmailChange = {
  /** `j***@example.com`: never the full address, and identical whether or not that address has an account. */
  newEmailMasked: string;
  expiresAt: Date;
  attemptsLeft: number;
};

/** The account's pending change, if it has one that has not expired. */
export async function getPendingEmailChange(
  userId: string,
  deps: Deps = {},
): Promise<PendingEmailChange | null> {
  const row = await repo.getRequest(userId);
  if (!row || row.expiresAt.getTime() <= clock(deps).getTime()) return null;
  return {
    newEmailMasked: maskEmail(row.newEmail),
    expiresAt: row.expiresAt,
    attemptsLeft: Math.max(0, EMAIL_CHANGE_MAX_ATTEMPTS - row.attempts),
  };
}

// --- Start -----------------------------------------------------------------------------------------------------------

export type RequestEmailChangeArgs = {
  userId: string;
  /** The account's current address (from the session). */
  currentEmail: string;
  /** Already normalized by the schema. */
  newEmail: string;
  currentPassword: string;
  /** Page language, for the emails. */
  locale: Locale;
  /** Coarse device label (`chrome/windows`) of this request, shown in the notice to the current address. */
  device: string | null;
};

/**
 * Starts a change. Order matters: the per-account limit (every attempt counts), the current password, "not the same
 * address", the send limits (per account, and per TARGET address whether or not it has an account), then ONE block
 * that takes at least ENUMERATION_FLOOR_MS whichever way the "is it taken" lookup went.
 */
export async function requestEmailChange(
  args: RequestEmailChangeArgs,
  deps: Deps = {},
): Promise<{ status: "code-sent" }> {
  const now = clock(deps);
  await enforceLimit(policies.emailChangeUser, args.userId);

  const stored = await authRepo.getCredentialHash(args.userId);
  const check = stored ? await verifyPassword(args.currentPassword, stored) : { valid: false };
  if (!check.valid) {
    throw new AppError("BAD_REQUEST", "Wrong current password", {
      details: { field: "currentPassword", issue: "wrong_current_password" },
    });
  }
  // It is the person's own address, so saying so reveals nothing about anyone else.
  if (args.newEmail === args.currentEmail.toLowerCase()) {
    throw new AppError("VALIDATION_FAILED", "That is already the email address", {
      details: { field: "newEmail", issue: "same_email" },
    });
  }
  await enforceLimit(policies.emailChangeSendUser, args.userId);
  await enforceLimit(policies.emailChangeSendTarget, args.newEmail);

  const code = newCode();
  const cancelToken = newCancelToken();
  const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_MINUTES * 60_000);

  const ids = await withMinimumDuration(ENUMERATION_FLOOR_MS, async () => {
    // An address reserved for ANOTHER account's revert counts as taken (ADR 0027): the same footprint as an account.
    const taken =
      (await authRepo.findUserBrief(args.newEmail)) !== null ||
      (await repo.isReservedForOthers(args.newEmail, args.userId, now));
    try {
      return await getDb().$transaction(async (tx) => {
        await repo.replaceRequest(
          {
            userId: args.userId,
            newEmail: args.newEmail,
            codeHash: hashCode(args.userId, args.newEmail, code),
            cancelHash: hashCancelToken(cancelToken),
            expiresAt,
            createdAt: now,
          },
          tx,
        );
        await accountRepo.insertSecurityEvent(
          { userId: args.userId, type: "EMAIL_CHANGE_REQUESTED", createdAt: now },
          tx,
        );
        // To the CURRENT address, in both cases: if it were sent only when the change is real, the person reading
        // that mailbox could tell a taken address from a free one.
        const notice = await enqueueEmail(
          {
            template: "email-change-notice",
            to: args.currentEmail,
            locale: args.locale,
            payload: {
              newEmailMasked: maskEmail(args.newEmail),
              cancelUrl: `${base()}/${args.locale}${accountRoutes.cancelEmailChange}#token=${cancelToken}`,
              device: args.device,
              expiresMinutes: EMAIL_CHANGE_MINUTES,
            },
          },
          { db: tx, now },
        );
        const toNew = taken
          ? await enqueueEmail(
              {
                template: "email-change-taken",
                to: args.newEmail,
                locale: args.locale,
                payload: {},
              },
              { db: tx, now },
            )
          : await enqueueEmail(
              {
                template: "email-change-code",
                to: args.newEmail,
                locale: args.locale,
                payload: { code, expiresMinutes: EMAIL_CHANGE_MINUTES },
              },
              { db: tx, now },
            );
        return [notice, toNew];
      });
    } catch (err) {
      // Two requests from the same account at once: the unique index let one through.
      if (isUniqueViolation(err)) {
        throw new AppError("CONFLICT", "Another change was started at the same time", {
          details: { issue: "try_again" },
        });
      }
      throw err;
    }
  });
  dispatchAfterResponse(ids);
  return { status: "code-sent" };
}

// --- Resend ----------------------------------------------------------------------------------------------------------

/**
 * A new code for the pending change (the old one stops working, the attempt counter restarts). No password is asked:
 * the destination was fixed when the password was; a stolen session cannot redirect an existing request.
 */
export async function resendEmailChangeCode(
  args: { userId: string; locale: Locale },
  deps: Deps = {},
): Promise<{ status: "code-sent" }> {
  const now = clock(deps);
  await enforceLimit(policies.emailChangeSendUser, args.userId);
  const pending = await repo.getRequest(args.userId);
  if (!pending || pending.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("BAD_REQUEST", "No email change in progress", {
      details: { issue: "no_email_change" },
    });
  }
  await enforceLimit(policies.emailChangeSendTarget, pending.newEmail);

  const code = newCode();
  const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_MINUTES * 60_000);
  const id = await withMinimumDuration(ENUMERATION_FLOOR_MS, async () => {
    const taken =
      (await authRepo.findUserBrief(pending.newEmail)) !== null ||
      (await repo.isReservedForOthers(pending.newEmail, args.userId, now));
    return getDb().$transaction(async (tx) => {
      const renewed = await repo.renewCode(
        args.userId,
        hashCode(args.userId, pending.newEmail, code),
        expiresAt,
        tx,
      );
      if (!renewed) {
        throw new AppError("BAD_REQUEST", "No email change in progress", {
          details: { issue: "no_email_change" },
        });
      }
      return taken
        ? enqueueEmail(
            {
              template: "email-change-taken",
              to: pending.newEmail,
              locale: args.locale,
              payload: {},
            },
            { db: tx, now },
          )
        : enqueueEmail(
            {
              template: "email-change-code",
              to: pending.newEmail,
              locale: args.locale,
              payload: { code, expiresMinutes: EMAIL_CHANGE_MINUTES },
            },
            { db: tx, now },
          );
    });
  });
  dispatchAfterResponse([id]);
  return { status: "code-sent" };
}

// --- Confirm ---------------------------------------------------------------------------------------------------------

export type ConfirmEmailChangeArgs = {
  userId: string;
  /** The session making the change: it stays signed in. */
  sessionId: string;
  /** The address being left (from the session); it is told afterwards. */
  currentEmail: string;
  code: string;
  locale: Locale;
};

/**
 * Finishes the change with the code sent to the new address. Wrong codes are counted atomically and the request dies
 * at EMAIL_CHANGE_MAX_ATTEMPTS. On success, in ONE transaction: the request is consumed (a double submit changes
 * nothing twice), the address moves (it counts as verified: the person just proved the inbox), every OTHER session is
 * deleted, reset links issued to the old address are deleted, the event is written and the OLD address is told.
 */
export async function confirmEmailChange(
  args: ConfirmEmailChangeArgs,
  deps: Deps = {},
): Promise<{ status: "changed"; signedOutOthers: number }> {
  const now = clock(deps);
  await enforceLimit(policies.emailChangeVerifyUser, args.userId);

  const pending = await repo.getRequest(args.userId);
  if (!pending) {
    throw new AppError("BAD_REQUEST", "No email change in progress", {
      details: { issue: "no_email_change" },
    });
  }
  if (pending.expiresAt.getTime() <= now.getTime()) {
    await repo.deleteRequest(pending.id);
    throw new AppError("BAD_REQUEST", "The code has expired", {
      details: { issue: "expired_code" },
    });
  }
  if (pending.attempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
    await repo.deleteRequest(pending.id);
    throw new AppError("BAD_REQUEST", "Too many wrong codes", {
      details: { issue: "too_many_attempts" },
    });
  }

  if (!sameHex(hashCode(args.userId, pending.newEmail, args.code), pending.codeHash)) {
    const attempts = await repo.bumpAttempts(args.userId);
    if (attempts !== null && attempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
      await repo.deleteRequest(pending.id);
      throw new AppError("BAD_REQUEST", "Too many wrong codes", {
        details: { issue: "too_many_attempts" },
      });
    }
    throw new AppError("BAD_REQUEST", "Invalid code", { details: { issue: "invalid_code" } });
  }

  try {
    const { signedOutOthers, noticeId } = await getDb().$transaction(async (tx) => {
      // Consume the request first: of two simultaneous submissions of a right code, exactly one gets past this line.
      if ((await repo.deleteRequest(pending.id, tx)) !== 1) {
        throw new AppError("BAD_REQUEST", "No email change in progress", {
          details: { issue: "no_email_change" },
        });
      }
      if (!(await repo.updateUserEmail(args.userId, pending.newEmail, now, tx))) {
        throw new AppError("NOT_FOUND", "Account not found");
      }
      // Someone else's revert may have reserved the address since the request was made.
      if (await repo.isReservedForOthers(pending.newEmail, args.userId, now, tx)) {
        throw new AddressUnavailable();
      }
      const removed = await accountRepo.deleteOtherSessions(args.userId, args.sessionId, tx);
      await repo.deleteResetTokens(args.userId, tx);
      // The way back: reserve the address being left and mint the single-use revert link for it (ADR 0027).
      const revertToken = newCancelToken();
      await repo.replaceRevert(
        {
          userId: args.userId,
          oldEmail: args.currentEmail.toLowerCase(),
          newEmail: pending.newEmail,
          tokenHash: hashRevertToken(revertToken),
          expiresAt: new Date(now.getTime() + EMAIL_REVERT_DAYS * 86_400_000),
          createdAt: now,
        },
        tx,
      );
      await accountRepo.insertSecurityEvent(
        { userId: args.userId, type: "EMAIL_CHANGED", createdAt: now },
        tx,
      );
      const id = await enqueueEmail(
        {
          template: "email-changed",
          to: args.currentEmail,
          locale: args.locale,
          payload: {
            newEmailMasked: maskEmail(pending.newEmail),
            contactUrl: `${base()}/${args.locale}${routes.contact}`,
            revertUrl: `${base()}/${args.locale}${accountRoutes.revertEmailChange}#token=${revertToken}`,
            revertDays: EMAIL_REVERT_DAYS,
          },
        },
        { db: tx, now },
      );
      return { signedOutOthers: removed, noticeId: id };
    });
    dispatchAfterResponse([noticeId]);
    return { status: "changed", signedOutOthers };
  } catch (err) {
    // Someone registered or moved to this address while the code was in the mail. The person holds the code, so they
    // control that inbox: telling them it is no longer free reveals nothing they could not already see there.
    if (isUniqueViolation(err) || err instanceof AddressUnavailable) {
      await repo.deleteRequest(pending.id).catch(() => undefined);
      throw new AppError("CONFLICT", "That address can no longer be used", {
        details: { issue: "email_unavailable" },
      });
    }
    throw err;
  }
}

// --- Cancel ----------------------------------------------------------------------------------------------------------

/** The signed-in person drops their own pending change ("use a different address"). Logged only if there was one. */
export async function discardEmailChange(
  userId: string,
  deps: Deps = {},
): Promise<{ status: "discarded" }> {
  const removed = await repo.deleteRequestOfUser(userId);
  if (removed > 0) {
    await recordSecurityEvent({ userId, type: "EMAIL_CHANGE_CANCELLED", createdAt: clock(deps) });
  }
  return { status: "discarded" };
}

/**
 * The cancel link from the notice to the CURRENT address. Opening the link does nothing; this runs when its button is
 * pressed (a POST). The token is 256 random bits, so telling a live link from a dead one leaks nothing.
 *
 * Whoever started the change knew the password, so it is treated as exposed: in ONE transaction the request is removed,
 * EVERY session of the account is deleted (the owner's too: they sign in again after the reset) and the event is
 * written; afterwards a password-reset link is emailed to the account's address (decided 2026-11-10).
 */
export async function cancelEmailChangeByToken(
  token: string,
  deps: Deps = {},
): Promise<{ status: "cancelled" }> {
  const now = clock(deps);
  const userId = await getDb().$transaction(async (tx) => {
    const taken = await repo.takeByCancelHash(hashCancelToken(token), tx);
    if (!taken) {
      throw new AppError("BAD_REQUEST", "Invalid or expired link", {
        details: { issue: "invalid_token" },
      });
    }
    await accountRepo.deleteAllSessions(taken.userId, tx);
    await accountRepo.insertSecurityEvent(
      { userId: taken.userId, type: "EMAIL_CHANGE_CANCELLED", createdAt: now },
      tx,
    );
    return taken.userId;
  });
  const user = await repo.getUserForNotice(userId);
  if (user) dispatchAfterResponse(await queueResetLink(user.email, localeOf(user.locale)));
  logger.info("email_change_cancelled_by_link");
  return { status: "cancelled" };
}

// --- Revert ----------------------------------------------------------------------------------------------------------

/**
 * The undo link from the notice to the OLD address (ADR 0027), valid EMAIL_REVERT_DAYS, single use, consumed when its
 * button is pressed (a POST). In ONE transaction: the link is consumed, the account gets its old address back (the
 * address it held at that moment is released), EVERY session is deleted, reset links and any pending change are removed,
 * the stored password is replaced by a hash of a random value (a reset is required), the event is written and both
 * addresses are told. If another account somehow holds the old address the transaction rolls back (the link stays
 * as it was) and the answer points to support. A reset link is emailed to the restored address afterwards.
 */
export async function revertEmailChangeByToken(
  token: string,
  deps: Deps = {},
): Promise<{ status: "reverted" }> {
  const now = clock(deps);
  const unusable = await hashPassword(randomBytes(32).toString("hex"), passwordConfigFromEnv());
  const unavailable = () =>
    new AppError("CONFLICT", "The old address can no longer be restored", {
      details: { issue: "address_unavailable" },
    });
  try {
    const done = await getDb().$transaction(async (tx) => {
      const row = await repo.takeRevertByHash(hashRevertToken(token), now, tx);
      const user = row ? await repo.getUserForNotice(row.userId, tx) : null;
      if (!row || !user) {
        throw new AppError("BAD_REQUEST", "Invalid or expired link", {
          details: { issue: "invalid_token" },
        });
      }
      if (await repo.emailHeldByOther(row.oldEmail, row.userId, tx)) throw unavailable();
      const leaving = user.email;
      if (leaving !== row.oldEmail) {
        if (!(await repo.updateUserEmail(row.userId, row.oldEmail, now, tx))) throw unavailable();
      }
      await accountRepo.deleteAllSessions(row.userId, tx);
      await repo.deleteResetTokens(row.userId, tx);
      await repo.deleteRequestOfUser(row.userId, tx);
      await repo.deleteRevertsOfUser(row.userId, tx);
      await repo.setCredentialHash(row.userId, unusable, now, tx);
      await accountRepo.insertSecurityEvent(
        { userId: row.userId, type: "EMAIL_CHANGE_REVERTED", createdAt: now },
        tx,
      );
      const locale = localeOf(user.locale);
      const ids = [
        await enqueueEmail(
          { template: "email-reverted", to: row.oldEmail, locale, payload: {} },
          { db: tx, now },
        ),
      ];
      if (leaving !== row.oldEmail) {
        ids.push(
          await enqueueEmail(
            { template: "email-revert-released", to: leaving, locale, payload: {} },
            { db: tx, now },
          ),
        );
      }
      return { ids, email: row.oldEmail, locale };
    });
    dispatchAfterResponse([...done.ids, ...(await queueResetLink(done.email, done.locale))]);
    logger.info("email_change_reverted_by_link");
    return { status: "reverted" };
  } catch (err) {
    if (isUniqueViolation(err)) throw unavailable();
    throw err;
  }
}
