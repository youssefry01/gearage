import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { accountRoutes, routes } from "@/config/routes";
import { ENUMERATION_FLOOR_MS } from "@/domain/auth";
import { EMAIL_CHANGE_MAX_ATTEMPTS, EMAIL_CHANGE_MINUTES, maskEmail } from "@/domain/email-change";
import { policies } from "@/domain/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/locales";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import * as accountRepo from "@/server/repositories/account.repository";
import * as authRepo from "@/server/repositories/auth.repository";
import * as repo from "@/server/repositories/email-change.repository";
import { hmacHex } from "@/server/security/keys";
import { verifyPassword } from "@/server/security/password";
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
    const taken = (await authRepo.findUserBrief(args.newEmail)) !== null;
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
    const taken = (await authRepo.findUserBrief(pending.newEmail)) !== null;
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
      const removed = await accountRepo.deleteOtherSessions(args.userId, args.sessionId, tx);
      await repo.deleteResetTokens(args.userId, tx);
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
    if (isUniqueViolation(err)) {
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
 */
export async function cancelEmailChangeByToken(
  token: string,
  deps: Deps = {},
): Promise<{ status: "cancelled" }> {
  const taken = await repo.takeByCancelHash(hashCancelToken(token));
  if (!taken) {
    throw new AppError("BAD_REQUEST", "Invalid or expired link", {
      details: { issue: "invalid_token" },
    });
  }
  await recordSecurityEvent({
    userId: taken.userId,
    type: "EMAIL_CHANGE_CANCELLED",
    createdAt: clock(deps),
  });
  logger.info("email_change_cancelled_by_link");
  return { status: "cancelled" };
}
