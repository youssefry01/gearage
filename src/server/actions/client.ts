import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { policies, type RateLimitPolicy } from "@/domain/rate-limit";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clientSubject } from "@/server/security/rate-limit/http";
import { getLimiter } from "@/server/security/rate-limit/limiter";
import { headers } from "next/headers";

/** What an action returns to the client when it fails on purpose. The UI maps `code` to translated text. */
export type ActionError = { code: string; message: string; retryAfterSec?: number };

const policyNames = Object.values(policies).map((p) => p.name) as [string, ...string[]];

/**
 * The ONLY way to define a Server Action (ADR 0013). Every action declares its rate-limit policy in `.metadata()`;
 * the middleware enforces it per client IP BEFORE the input is validated or any work is done, so a refused request
 * costs one counter hit. Unexpected errors are logged and reach the client as a generic INTERNAL error (no stack, no
 * message); deliberate AppErrors keep their code. Session-checking `authedAction` joins in M5a-2.
 */
export const publicAction = createSafeActionClient({
  defineMetadataSchema: () => z.object({ policy: z.enum(policyNames) }),
  handleServerError(error): ActionError {
    if (isAppError(error)) {
      const retry = (error.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
      return {
        code: error.code,
        message: error.message,
        ...(retry ? { retryAfterSec: retry } : {}),
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
