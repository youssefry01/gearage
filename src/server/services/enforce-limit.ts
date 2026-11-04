import type { RateLimitPolicy } from "@/domain/rate-limit";
import { AppError } from "@/lib/errors";
import { getLimiter } from "@/server/security/rate-limit/limiter";

/**
 * Counts one hit against `policy` for `subject` and refuses (RATE_LIMITED, or UNAVAILABLE when no counter store can
 * answer a fail-closed policy) once the limit is passed. For limits keyed by something other than the client IP, which
 * the Server Action middleware cannot know (the typed email, the signed-in account).
 */
export async function enforceLimit(policy: RateLimitPolicy, subject: string): Promise<void> {
  const result = await getLimiter().hit(policy, subject);
  if (result.allowed) return;
  if (result.unavailable)
    throw new AppError("UNAVAILABLE", "Temporarily unavailable. Try again shortly.");
  throw new AppError("RATE_LIMITED", "Too many attempts. Try again later.", {
    details: { retryAfterSec: result.retryAfterSec },
  });
}
