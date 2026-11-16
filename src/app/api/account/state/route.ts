import { accountStateFor, type AccountState } from "@/domain/account-state";
import { policies } from "@/domain/rate-limit";
import { handle, ok } from "@/lib/api-response";
import { hasSessionCookie } from "@/server/auth/session-cookie";
import { getSession } from "@/server/auth/session";
import { limitRequest } from "@/server/security/rate-limit/http";

export const dynamic = "force-dynamic";

/** Per visitor and never shared: a CDN or the browser cache must not hand one person's answer to another. */
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" } as const;

/**
 * Who is signed in, for the header's account menu (M5b-2b, ADR 0028). The header lives in the layout of every page, and
 * reading the session cookie there would make every page dynamic (no ISR, no CDN cache), so the page stays static and
 * this endpoint is asked once from the browser instead. A visitor without a session cookie gets "signed out" at once,
 * without the rate limiter or the database; a visitor with one costs a limiter hit and the usual session lookup, and
 * learns only their own first name. Rate limited per IP, fail open (the header then stays neutral, ADR 0021).
 */
export const GET = handle(async (request: Request) => {
  if (!hasSessionCookie(request.headers.get("cookie"))) {
    return ok<AccountState>(accountStateFor(null), { headers: PRIVATE });
  }
  const limited = await limitRequest(request, policies.accountState);
  if (limited) return limited;
  const session = await getSession();
  return ok<AccountState>(accountStateFor(session ? session.user.firstName : null), {
    headers: PRIVATE,
  });
});
