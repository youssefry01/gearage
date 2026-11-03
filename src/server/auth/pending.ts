import { cookies } from "next/headers";
import { PENDING_VERIFICATION_MINUTES } from "@/domain/auth";
import { getEnv } from "@/lib/env";
import { deriveKey } from "@/server/security/keys";
import {
  PENDING_COOKIE_NAME,
  PENDING_PURPOSE,
  decodePending,
  encodePending,
} from "./pending-token";

/**
 * "Which address is the verify page waiting for?" (ADR 0024). Before M5b the address travelled in the URL
 * (`/verify-email?email=`), where it reached browser history, server logs and screenshots. Now it lives in a short-lived
 * cookie signed with a key derived from AUTH_SECRET: HttpOnly (scripts cannot read it), SameSite=Lax, Secure over https,
 * 30 minutes. The signature stops a person from pointing the page, or the verify action, at somebody else's address.
 *
 * The cookie carries only the address and an expiry. It proves nothing about the account: a code is still required,
 * and the cookie is set identically whether or not the address already has an account (no enumeration).
 */
const key = () => deriveKey(PENDING_PURPOSE);

function cookieAttributes() {
  const secure = new URL(getEnv().APP_URL).protocol === "https:";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: PENDING_VERIFICATION_MINUTES * 60,
  };
}

/** Remembers the address the verify page is waiting for. Call from a Server Action. */
export async function setPendingEmail(email: string, now: Date = new Date()): Promise<void> {
  (await cookies()).set(
    PENDING_COOKIE_NAME,
    encodePending(email, now.getTime(), key()),
    cookieAttributes(),
  );
}

/** The remembered address, or null (no cookie, expired or tampered). */
export async function getPendingEmail(now: Date = new Date()): Promise<string | null> {
  // cookies() first: it opts the calling page out of static generation before anything reads the environment.
  const store = await cookies();
  return decodePending(store.get(PENDING_COOKIE_NAME)?.value, now.getTime(), key());
}

export async function clearPendingEmail(): Promise<void> {
  (await cookies()).set(PENDING_COOKIE_NAME, "", { ...cookieAttributes(), maxAge: 0 });
}
