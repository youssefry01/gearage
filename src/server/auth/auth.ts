import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { brand } from "@/config/brand";
import {
  CODE_EXPIRES_MINUTES,
  CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
  RESET_EXPIRES_MINUTES,
  SESSION_DAYS,
} from "@/domain/auth";
import { defaultLocale, locales, type Locale } from "@/i18n/locales";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import { enqueueEmail } from "@/server/services/email.service";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { currentAuthContext } from "./context";

/**
 * THE ONLY file that configures Better Auth (ADR 0002, ESLint keeps `better-auth` imports here and in `session.ts`).
 *
 * Decisions that matter for security:
 *  - The HTTP handler is NOT mounted (no `app/api/auth`). Every flow runs through our own Server Actions, which apply
 *    our rate limits, lockout and anti-enumeration timing first and call `auth.api.*` directly. There is no public
 *    Better Auth endpoint to forget to protect. A test fails if `src/app/api/auth` ever appears.
 *  - Passwords are Argon2id with a versioned pepper (ADR 0003), through `emailAndPassword.password`.
 *  - Email is verified with a 6-digit code (email OTP plugin, hashed at rest, a few attempts per code).
 *  - Sessions are database rows addressed by an opaque token in an HttpOnly, SameSite=Lax cookie (Secure over https);
 *    the session is looked up on every request (no cookie cache), so revoking it takes effect at once.
 *  - Better Auth's own rate limiter is off (it only guards the handler we do not mount); ours applies.
 */

function localeFromContext(fallback?: string | null): Locale {
  const fromCall = currentAuthContext()?.locale;
  if (fromCall) return fromCall;
  return (locales as readonly string[]).includes(fallback ?? "")
    ? (fallback as Locale)
    : defaultLocale;
}

/** Queues an email through the outbox and reports its id to the calling service. Never throws into Better Auth. */
async function queue(
  to: string,
  fallbackLocale: string | null | undefined,
  email:
    | { template: "verify-code"; payload: { code: string; expiresMinutes: number } }
    | { template: "reset-password"; payload: { url: string; expiresMinutes: number } }
    | { template: "account-exists"; payload: Record<string, never> },
): Promise<void> {
  try {
    const id = await enqueueEmail({
      ...email,
      to,
      locale: localeFromContext(fallbackLocale),
    } as Parameters<typeof enqueueEmail>[0]);
    currentAuthContext()?.queuedEmailIds.push(id);
  } catch (err) {
    // The shopper can ask for another code; never let an outbox problem change what the response reveals.
    logger.error("auth_email_enqueue_failed", { template: email.template, err });
  }
}

/** Base for the link in the reset email. The token travels in the URL FRAGMENT so it never reaches a server log or a Referer. */
export function resetLink(locale: Locale, token: string): string {
  const base = getEnv().APP_URL.replace(/\/+$/, "");
  return `${base}/${locale}/reset-password#token=${encodeURIComponent(token)}`;
}

/** Where Better Auth may send the browser after validating a link (must be on our origin; we never use its GET route). */
export function resetRedirectUrl(locale: Locale): string {
  return `${getEnv().APP_URL.replace(/\/+$/, "")}/${locale}/reset-password`;
}

function createAuth() {
  const env = getEnv();
  const secureCookies = new URL(env.APP_URL).protocol === "https:";
  return betterAuth({
    appName: brand.name.en,
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    trustedOrigins: [new URL(env.APP_URL).origin],
    database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
    rateLimit: { enabled: false },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // Our policy (12 to 128 code points after NFKC, breach check) runs before Better Auth sees a password; its own
      // length bounds are only a backstop and are in UTF-16 units, so keep them wide enough never to disagree.
      minPasswordLength: 1,
      maxPasswordLength: 1024,
      password: {
        hash: (password) => hashPassword(password),
        verify: async ({ hash, password }) => (await verifyPassword(password, hash)).valid,
      },
      resetPasswordTokenExpiresIn: RESET_EXPIRES_MINUTES * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const locale = localeFromContext((user as { locale?: string }).locale);
        await queue(user.email, locale, {
          template: "reset-password",
          payload: { url: resetLink(locale, token), expiresMinutes: RESET_EXPIRES_MINUTES },
        });
      },
      // A registration for an address that already has an account looks exactly like a new one from outside; the owner
      // is told by email instead (Better Auth returns the same generic response and spends one password hash).
      onExistingUserSignUp: async ({ user }) => {
        await queue(user.email, (user as { locale?: string }).locale, {
          template: "account-exists",
          payload: {},
        });
      },
    },
    emailVerification: { autoSignInAfterVerification: true },
    user: {
      additionalFields: {
        firstName: { type: "string", required: true, input: true },
        lastName: { type: "string", required: true, input: true },
        phone: { type: "string", required: true, input: true },
        dateOfBirth: { type: "date", required: false, input: true },
        gender: { type: "string", required: false, input: true },
        locale: { type: "string", required: true, input: true },
        termsAcceptedAt: { type: "date", required: true, input: true },
        termsVersion: { type: "string", required: true, input: true },
        privacyAcceptedAt: { type: "date", required: true, input: true },
        privacyVersion: { type: "string", required: true, input: true },
        marketingConsent: { type: "boolean", required: true, input: true },
        marketingConsentAt: { type: "date", required: false, input: true },
      },
    },
    session: { expiresIn: SESSION_DAYS * 86_400, updateAge: 86_400 },
    advanced: {
      cookiePrefix: "auth",
      useSecureCookies: secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      database: { generateId: false },
      // Data minimization: no IP address is stored on sessions. The M5b sessions list can revisit this.
      ipAddress: { disableIpTracking: true },
    },
    plugins: [
      emailOTP({
        otpLength: CODE_LENGTH,
        expiresIn: CODE_EXPIRES_MINUTES * 60,
        allowedAttempts: CODE_MAX_ATTEMPTS,
        storeOTP: "hashed",
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "email-verification") return; // sign-in and OTP-reset are not used (ADR 0002)
          await queue(email, null, {
            template: "verify-code",
            payload: { code: otp, expiresMinutes: CODE_EXPIRES_MINUTES },
          });
        },
      }),
      nextCookies(), // must be the last plugin: it copies Set-Cookie into Next's cookie store for Server Actions
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __auth?: Auth };

/** Lazy singleton (never at import time, so builds and tests work without a database). Survives HMR in dev. */
export function getAuth(): Auth {
  globalForAuth.__auth ??= createAuth();
  return globalForAuth.__auth;
}

/** Names of the cookies Better Auth sets, for tests and the manual-test guide. */
export const SESSION_COOKIE_BASENAME = "auth.session_token";
