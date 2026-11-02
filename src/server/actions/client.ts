import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { policies, type RateLimitPolicy } from "@/domain/rate-limit";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clientSubject } from "@/server/security/rate-limit/http";
import { getLimiter } from "@/server/security/rate-limit/limiter";
import { headers } from "next/headers";
import { getSession } from "@/server/auth/session";

/** What an action returns to the client when it fails on purpose. The UI maps `code` to translated text. */
/**
 * `field` and `issue` carry a SAFE, machine-readable reason (for example field "password", issue "breached", or
 * issue "locked") that the form turns into translated text. They never carry anything about other people's accounts.
 */
export type ActionError = {
  code: string;
  message: string;
  retryAfterSec?: number;
  field?: string;
  issue?: string;
};

const policyNames = Object.values(policies).map((p) => p.name) as [string, ...string[]];

/**
 * The ONLY way to define a Server Action (ADR 0013). Every action declares its rate-limit policy in `.metadata()`;
 * the middleware enforces it per client IP BEFORE the input is validated or any work is done, so a refused request
 * costs one counter hit. Unexpected errors are logged and reach the client as a generic INTERNAL error (no stack, no
 * message); deliberate AppErrors keep their code.
 */
export const publicAction = createSafeActionClient({
  defineMetadataSchema: () => z.object({ policy: z.enum(policyNames) }),
  handleServerError(error): ActionError {
    if (isAppError(error)) {
      const d = error.details as
        { retryAfterSec?: number; field?: string; issue?: string; reason?: string } | undefined;
      const issue = d?.issue ?? d?.reason;
      return {
        code: error.code,
        message: error.message,
        ...(d?.retryAfterSec ? { retryAfterSec: d.retryAfterSec } : {}),
        ...(d?.field ? { field: d.field } : {}),
        ...(issue ? { issue } : {}),
      };
    }
    logger.error("server_action_error", { err: error });
    return { code: "INTERNAL", message: "Something went wrong" };
  },
}).use(async ({ next, metadata }) => {
  const policy = Object.values(policies).find(
    (p): p is RateLimitPolicy => p.name === metadata.policy,
  );
  if (!policy) throw new Error(`Unknown rate-limit policy: ${metadata.policy}`);
  const result = await getLimiter().hit(policy, clientSubject(await headers()));
  if (!result.allowed) {
    throw result.unavailable
      ? new AppError("UNAVAILABLE", "Temporarily unavailable. Try again shortly.")
      : new AppError("RATE_LIMITED", "Too many attempts. Try again later.", {
          details: { retryAfterSec: result.retryAfterSec },
        });
  }
  return next();
});

/**
 * Like `publicAction`, but the caller must hold a valid session: the session is looked up from the cookie BEFORE any
 * work runs, and an anonymous call fails with UNAUTHENTICATED. The session is passed to the action as `ctx.session`.
 * Every mutation that belongs to a signed-in person uses this (HANDOFF conventions: authorization in every mutation).
 */
export const authedAction = publicAction.use(async ({ next }) => {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  return next({ ctx: { session } });
});
