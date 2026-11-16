import { SESSION_COOKIE_BASENAME } from "./auth";

/**
 * Is a session cookie present in a Cookie header? Presence only: whether it is still valid is the database's answer
 * (`getSession`). The cookie is HttpOnly, so the browser cannot ask; /api/account/state uses this to answer an
 * anonymous visitor without touching the rate limiter or the database. Better Auth prefixes the name with
 * `__Secure-` over https.
 */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const name = SESSION_COOKIE_BASENAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|;\\s*)(?:__Secure-)?${name}=[^;\\s]+`).test(cookieHeader);
}
