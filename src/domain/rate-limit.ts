/**
 * Rate-limit policies (ADR 0021). A policy is a fixed window: at most `max` hits per `windowSec` per identifier.
 * `failMode` is what happens when NEITHER the Upstash limiter NOR the Postgres fallback can answer:
 *   "closed" = refuse (brute-force defence for authentication: better to be unavailable than unprotected),
 *   "open"   = allow (a public read must not break because a counter store is down).
 * Authentication policies are all fail-closed and public reads all fail-open; a test enforces both rules.
 */
export type RateLimitPolicy = {
  readonly name: string;
  readonly max: number;
  readonly windowSec: number;
  readonly failMode: "open" | "closed";
};

const policy = (
  name: string,
  max: number,
  windowSec: number,
  failMode: "open" | "closed",
): RateLimitPolicy => Object.freeze({ name, max, windowSec, failMode });

export const policies = {
  // Public reads (fail open). Per client IP; a shared "unknown" bucket applies when no trusted IP is available.
  searchSuggest: policy("search.suggest", 120, 60, "open"),
  productCards: policy("products.cards", 60, 60, "open"),
  status: policy("status", 60, 60, "open"),
  // View tracking (fail open: the event is dropped, the shopper never notices).
  viewIp: policy("product.view.ip", 120, 60, "open"),
  viewDedupe: policy("product.view.dedupe", 1, 30 * 60, "open"),
  // Authentication (fail closed). Used from M5a-2; declared here so the failure policy is decided once, in one place.
  loginIp: policy("auth.login.ip", 20, 5 * 60, "closed"),
  loginEmail: policy("auth.login.email", 10, 15 * 60, "closed"),
  registerIp: policy("auth.register.ip", 10, 60 * 60, "closed"),
  codeSendEmail: policy("auth.code.send.email", 3, 10 * 60, "closed"),
  codeSendIp: policy("auth.code.send.ip", 10, 60 * 60, "closed"),
  codeVerifyEmail: policy("auth.code.verify.email", 10, 15 * 60, "closed"),
  resetRequestEmail: policy("auth.reset.request.email", 3, 60 * 60, "closed"),
  resetRequestIp: policy("auth.reset.request.ip", 10, 60 * 60, "closed"),
  codeVerifyIp: policy("auth.code.verify.ip", 30, 15 * 60, "closed"),
  authSession: policy("auth.session.ip", 60, 60, "closed"),
  resetConfirmIp: policy("auth.reset.confirm.ip", 10, 15 * 60, "closed"),
  // Changing the password asks for the current one, so it is a password-guessing oracle for anyone holding a stolen
  // session: few tries per account (counted on every attempt, right or wrong) and per IP (M5b-1, ADR 0025).
  passwordChangeUser: policy("auth.password.change.user", 6, 15 * 60, "closed"),
  passwordChangeIp: policy("auth.password.change.ip", 20, 15 * 60, "closed"),
  // Email change (M5b-2a, ADR 0026). Starting one asks for the current password, so, like a password change, it is a
  // guessing oracle for a stolen session: few tries per account (counted on every attempt, right or wrong).
  emailChangeUser: policy("auth.email.change.user", 6, 15 * 60, "closed"),
  emailChangeIp: policy("auth.email.change.ip", 20, 15 * 60, "closed"),
  // Every request and every resend emails a stranger (the new address) and the owner (the current one): cap them per
  // account and per TARGET address, and count the target whether or not it has an account (no enumeration).
  emailChangeSendUser: policy("auth.email.change.send.user", 5, 60 * 60, "closed"),
  emailChangeSendTarget: policy("auth.email.change.send.target", 3, 60 * 60, "closed"),
  emailChangeVerifyUser: policy("auth.email.change.verify.user", 10, 15 * 60, "closed"),
  emailChangeCancelIp: policy("auth.email.change.cancel.ip", 10, 15 * 60, "closed"),
} as const;

export type LimitResult = {
  /** The request may proceed. */
  allowed: boolean;
  /** Seconds until the window resets (0 when allowed and nothing is known). */
  retryAfterSec: number;
  /** Neither store could answer; `allowed` then follows the policy's failMode. */
  unavailable: boolean;
};

/** Fixed-window decision for the count INCLUDING the current hit. */
export function isAllowed(count: number, max: number): boolean {
  return count <= max;
}

export function retryAfterSeconds(resetAtMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
}
