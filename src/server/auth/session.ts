import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "./auth";

/** What the rest of the app may know about the signed-in person. Our shape, so Better Auth stays swappable (ADR 0002). */
export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  locale: string;
};
export type AppSession = { user: SessionUser; sessionId: string; expiresAt: Date };

/**
 * The current session or null. Reads the session cookie, looks the session up in the database (no cookie cache, so a
 * revoked session stops working immediately) and is memoized per request. Safe in Server Components and actions; it
 * does not refresh the cookie from a Server Component (cookies are read-only there), which is fine: the expiry is
 * extended in the database and the cookie is renewed the next time an action runs.
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  // headers() FIRST, before anything reads configuration. During `next build` it throws Next's "dynamic usage"
  // signal, which opts the page out of static generation; only then is it safe for getAuth() to validate the
  // environment (secrets, database). Calling getAuth() first made every per-user page fail to prerender in a build
  // that has no environment (CI). A test pins this order.
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const user = result.user as typeof result.user & {
    firstName?: string;
    lastName?: string;
    locale?: string;
  };
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      locale: user.locale ?? "en",
    },
    sessionId: result.session.id,
    expiresAt: result.session.expiresAt,
  };
});
