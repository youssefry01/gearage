import {
  CODE_EXPIRES_MINUTES,
  CONSENT_VERSIONS,
  ENUMERATION_FLOOR_MS,
  LOCKOUT_DECAY_SECONDS,
  lockoutDelaySeconds,
  parseDateOfBirth,
  type RegisterData,
} from "@/domain/auth";
import { routes } from "@/config/routes";
import { needsRehash, parseStoredHash } from "@/domain/password-hash";
import { policies } from "@/domain/rate-limit";
import { defaultLocale, locales, type Locale } from "@/i18n/locales";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getAuth, resetRedirectUrl } from "@/server/auth/auth";
import { runWithAuthContext } from "@/server/auth/context";
import { authErrorCode } from "@/server/auth/errors";
import * as repo from "@/server/repositories/auth.repository";
import * as emailChangeRepo from "@/server/repositories/email-change.repository";
import { recordSecurityEvent } from "@/server/services/account.service";
import { enqueueEmail } from "@/server/services/email.service";
import { hashPassword, passwordConfigFromEnv } from "@/server/security/password";
import { hmacHex } from "@/server/security/keys";
import { withMinimumDuration } from "@/server/security/timing";
import { dispatchAfterResponse } from "@/server/services/after-response";
import { enforceLimit } from "@/server/services/enforce-limit";
import { assessPassword } from "@/server/services/password-policy.service";

/**
 * Authentication flows (M5a-2a, ADR 0002 and 0024). Called by the Server Actions, which have already applied the
 * per-IP policy and validated the shape of the input. Rules every function here keeps:
 *  - Anything that differs by "this email has an account" answers the same words and takes at least
 *    ENUMERATION_FLOOR_MS, and sends its email through the outbox (a queued row, never a network call).
 *  - Per-email limits are keyed by the typed address, never by whether the account exists.
 *  - Nothing here logs an email address, a code or a password.
 */

/**
 * `device` is the coarse label (`chrome/windows`) the calling action derived from the request's User-Agent; the raw
 * User-Agent never gets this far. It is stored on a session this call creates (ADR 0025).
 */
type Deps = { now?: () => Date; device?: string | null };

const limit = enforceLimit;

const throttleKey = (email: string) => hmacHex("login-throttle", email);

// --- Register ------------------------------------------------------------------------------------------------------

/**
 * Creates an unverified account and queues the verification code. For an address that already has an account the
 * answer is identical (and the owner gets an "account exists" email instead). Password problems ARE reported: they
 * say nothing about the address.
 */
export async function register(
  data: RegisterData,
  locale: Locale,
  deps: Deps = {},
): Promise<{ status: "check-email" }> {
  const now = (deps.now ?? (() => new Date()))();
  const assessment = await assessPassword(data.password);
  if (!assessment.ok) {
    throw new AppError("VALIDATION_FAILED", "Invalid password", {
      details: { field: "password", issue: assessment.issue },
    });
  }
  let dateOfBirth: Date | undefined;
  if (data.dateOfBirth) {
    const dob = parseDateOfBirth(data.dateOfBirth, now);
    if (!dob.ok) {
      throw new AppError("VALIDATION_FAILED", "Invalid date of birth", {
        details: { field: "dateOfBirth", issue: dob.error },
      });
    }
    dateOfBirth = dob.date;
  }

  const { queuedEmailIds } = await withMinimumDuration(ENUMERATION_FLOOR_MS, async () => {
    // An address held back for another account's email-change revert (ADR 0027) follows the SAME path as an address with
    // an account: one password hash spent, the same email ("account-exists"), the same answer.
    if (await emailChangeRepo.isReservedForOthers(data.email, null, now)) {
      await hashPassword(data.password, passwordConfigFromEnv());
      const id = await enqueueEmail(
        { template: "account-exists", to: data.email, locale, payload: {} },
        { now },
      );
      return { value: null, queuedEmailIds: [id] };
    }
    return runWithAuthContext(locale, () =>
      getAuth().api.signUpEmail({
        body: {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          dateOfBirth,
          gender: data.gender ? data.gender.toUpperCase() : undefined,
          locale,
          termsAcceptedAt: now,
          termsVersion: CONSENT_VERSIONS.terms,
          privacyAcceptedAt: now,
          privacyVersion: CONSENT_VERSIONS.privacy,
          marketingConsent: data.marketingConsent,
          marketingConsentAt: data.marketingConsent ? now : undefined,
        },
      }),
    );
  });
  dispatchAfterResponse(queuedEmailIds);
  return { status: "check-email" };
}

// --- Verify and resend ---------------------------------------------------------------------------------------------

export type CodeFailure = "invalid_code" | "expired_code" | "too_many_attempts";

/** Checks a 6-digit code. On success the account is verified and the person is signed in (cookie set). */
export async function verifyEmail(
  email: string,
  code: string,
  deps: Deps = {},
): Promise<{ status: "verified" }> {
  await limit(policies.codeVerifyEmail, email);
  try {
    // The sign-in that follows a successful verification creates a session: give it this request's device label.
    await runWithAuthContext(
      defaultLocale,
      () => getAuth().api.verifyEmailOTP({ body: { email, otp: code } }),
      deps.device ?? null,
    );
  } catch (err) {
    const known = authErrorCode(err);
    const failure: CodeFailure =
      known === "OTP_EXPIRED"
        ? "expired_code"
        : known === "TOO_MANY_ATTEMPTS"
          ? "too_many_attempts"
          : "invalid_code";
    if (known === undefined) logger.error("auth_verify_failed", { err });
    throw new AppError("BAD_REQUEST", "Invalid code", { details: { issue: failure } });
  }
  return { status: "verified" };
}

/** Sends a new code if (and only if) the address has an UNVERIFIED account; otherwise does nothing, identically. */
export async function resendCode(email: string, locale: Locale): Promise<{ status: "sent" }> {
  await limit(policies.codeSendEmail, email);
  const { queuedEmailIds } = await withMinimumDuration(ENUMERATION_FLOOR_MS, async () => {
    const user = await repo.findUserBrief(email);
    if (!user || user.emailVerified) return { value: undefined, queuedEmailIds: [] as string[] };
    return runWithAuthContext(locale, () =>
      getAuth().api.sendVerificationOTP({ body: { email, type: "email-verification" } }),
    );
  });
  dispatchAfterResponse(queuedEmailIds);
  return { status: "sent" };
}

// --- Login ---------------------------------------------------------------------------------------------------------

export type LoginResult = { status: "ok" } | { status: "unverified" };

/**
 * Signs in. Order matters: per-email limit, then the lockout (which is checked BEFORE spending an Argon2 hash), then
 * Better Auth. A wrong password for a known and for an unknown address cost the same and count the same toward the
 * lockout. A correct password on an unverified account is not a failure: a fresh code is sent and the caller is told.
 */
export async function login(
  email: string,
  password: string,
  locale: Locale,
  deps: Deps = {},
): Promise<LoginResult> {
  const now = (deps.now ?? (() => new Date()))();
  await limit(policies.loginEmail, email);
  const key = throttleKey(email);

  const throttle = await repo.getThrottle(key);
  if (throttle?.lockedUntil && throttle.lockedUntil.getTime() > now.getTime()) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((throttle.lockedUntil.getTime() - now.getTime()) / 1000),
    );
    throw new AppError("RATE_LIMITED", "Too many failed attempts.", {
      details: { retryAfterSec, reason: "locked" },
    });
  }

  let userId: string;
  try {
    const { value: result, queuedEmailIds } = await runWithAuthContext(
      locale,
      () => getAuth().api.signInEmail({ body: { email, password } }),
      deps.device ?? null,
    );
    dispatchAfterResponse(queuedEmailIds);
    userId = result.user.id;
  } catch (err) {
    const code = authErrorCode(err);
    if (code === "EMAIL_NOT_VERIFIED") {
      await resendCode(email, locale).catch(() => undefined);
      return { status: "unverified" };
    }
    if (code === "INVALID_EMAIL_OR_PASSWORD") {
      const failures = await repo.bumpFailure(
        key,
        now,
        new Date(now.getTime() - LOCKOUT_DECAY_SECONDS * 1000),
      );
      const delay = lockoutDelaySeconds(failures);
      if (delay > 0) await repo.extendLock(key, new Date(now.getTime() + delay * 1000));
      throw new AppError("UNAUTHENTICATED", "Invalid email or password");
    }
    logger.error("auth_login_failed", { err });
    throw err;
  }

  await repo.clearThrottle(key);
  await rehashIfNeeded(userId, password, now);
  return { status: "ok" };
}

/** Rehash on login (ADR 0003): an old pepper version or old Argon2 parameters are replaced by the current ones. */
async function rehashIfNeeded(userId: string, password: string, now: Date): Promise<void> {
  try {
    const stored = await repo.getCredentialHash(userId);
    const parsed = stored ? parseStoredHash(stored) : null;
    if (!stored || !parsed) return;
    const config = passwordConfigFromEnv();
    if (!needsRehash(parsed, { pepperVersion: config.currentVersion, params: config.params }))
      return;
    await repo.replaceCredentialHash(userId, stored, await hashPassword(password, config), now);
  } catch (err) {
    // The sign-in succeeded; a failed upgrade is retried at the next one.
    logger.error("auth_rehash_failed", { err });
  }
}

// --- Forgot and reset password ------------------------------------------------------------------------------------

/** Emails a reset link if the address has an account; answers identically (and as slowly) either way. */
export async function requestPasswordReset(
  email: string,
  locale: Locale,
): Promise<{ status: "sent" }> {
  await limit(policies.resetRequestEmail, email);
  const { queuedEmailIds } = await withMinimumDuration(ENUMERATION_FLOOR_MS, () =>
    runWithAuthContext(locale, () =>
      getAuth().api.requestPasswordReset({ body: { email, redirectTo: resetRedirectUrl(locale) } }),
    ),
  );
  dispatchAfterResponse(queuedEmailIds);
  return { status: "sent" };
}

/**
 * Sets a new password from an emailed token. The token is consumed HERE (a POST), never by opening the link. The new
 * password meets the same policy as at registration. On success every session of the account is revoked, the address
 * counts as verified, and any sign-in lockout is cleared (the owner just proved who they are).
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  deps: Deps & { locale?: Locale } = {},
): Promise<{ status: "reset" }> {
  const now = (deps.now ?? (() => new Date()))();
  const assessment = await assessPassword(newPassword);
  if (!assessment.ok) {
    throw new AppError("VALIDATION_FAILED", "Invalid password", {
      details: { field: "password", issue: assessment.issue },
    });
  }
  const resetUser = await repo.findResetTokenUser(token, now);
  try {
    await getAuth().api.resetPassword({ body: { newPassword, token } });
  } catch (err) {
    if (authErrorCode(err) !== undefined) {
      throw new AppError("BAD_REQUEST", "Invalid or expired link", {
        details: { issue: "invalid_token" },
      });
    }
    logger.error("auth_reset_failed", { err });
    throw err;
  }
  if (resetUser) {
    await repo.clearThrottle(throttleKey(resetUser.email));
    await repo.markEmailVerified(resetUser.email, now);
    await recordSecurityEvent({ userId: resetUser.id, type: "PASSWORD_RESET", createdAt: now });
    await sendResetNotice(resetUser, deps, now);
  }
  return { status: "reset" };
}

/**
 * The same "your password was changed" notice a signed-in change sends (decided 2026-11-05), worded for a reset: every
 * device was signed out. Best effort and after the fact: the reset has already succeeded and must not fail because a
 * notice could not be queued. The language is the one the person was using on the reset page.
 */
async function sendResetNotice(
  user: { id: string; email: string; locale: string },
  deps: Deps & { locale?: Locale },
  now: Date,
): Promise<void> {
  try {
    const locale: Locale =
      deps.locale ??
      ((locales as readonly string[]).includes(user.locale)
        ? (user.locale as Locale)
        : defaultLocale);
    const id = await enqueueEmail(
      {
        template: "password-changed",
        to: user.email,
        locale,
        payload: {
          device: deps.device ?? null,
          resetUrl: `${getEnv().APP_URL.replace(/\/+$/, "")}/${locale}${routes.forgotPassword}`,
          method: "reset",
        },
      },
      { now },
    );
    dispatchAfterResponse([id]);
  } catch (err) {
    logger.error("auth_reset_notice_failed", { err });
  }
}

// --- Logout --------------------------------------------------------------------------------------------------------

export async function logout(requestHeaders: Headers): Promise<void> {
  await getAuth().api.signOut({ headers: requestHeaders });
}

export const VERIFY_CODE_MINUTES = CODE_EXPIRES_MINUTES;
