import type { BrowserContext } from "@playwright/test";
import {
  PENDING_COOKIE_NAME,
  PENDING_PURPOSE,
  encodePending,
} from "../../src/server/auth/pending-token";
import { deriveKey } from "../../src/server/security/keys";
import { E2E_AUTH_SECRET } from "./e2e-env";

/** Gives a context the signed cookie the verify page needs, exactly as register/login would have set it. */
export async function addPendingVerification(
  context: BrowserContext,
  baseURL: string,
  email = "shopper@example.test",
): Promise<void> {
  const value = encodePending(email, Date.now(), deriveKey(PENDING_PURPOSE, "", E2E_AUTH_SECRET));
  await context.addCookies([{ name: PENDING_COOKIE_NAME, value, url: baseURL }]);
}
