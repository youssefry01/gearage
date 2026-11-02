import { createHash } from "node:crypto";
import { breachCount, splitSha1 } from "@/domain/hibp";
import { normalizePassword } from "@/domain/password";
import { getEnv, isTestMode } from "@/lib/env";
import { logger } from "@/lib/logger";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const DEFAULT_TIMEOUT_MS = 2_500;

export type BreachCheck = { status: "ok"; count: number } | { status: "unknown" };

/**
 * Has this password appeared in a known breach? Uses the Pwned Passwords range API with k-anonymity: only the first
 * five hex characters of the SHA-1 leave the server, and `Add-Padding` hides how many real matches there are.
 * FAILS OPEN (status "unknown") on any network problem or timeout: a third-party outage must not stop registrations
 * (decision 2026-10-30). Never throws. In test mode no request is made unless a `fetch` is injected.
 */
export async function checkBreached(
  password: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<BreachCheck> {
  if (!options.fetch && isTestMode(getEnv())) return { status: "unknown" };
  const doFetch = options.fetch ?? fetch;
  const sha1 = createHash("sha1")
    .update(normalizePassword(password), "utf8")
    .digest("hex")
    .toUpperCase();
  const { prefix, suffix } = splitSha1(sha1);
  try {
    const response = await doFetch(`${RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "storefront-password-check" },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("hibp_unavailable", { status: response.status });
      return { status: "unknown" };
    }
    return { status: "ok", count: breachCount(await response.text(), suffix) };
  } catch (err) {
    logger.warn("hibp_unavailable", { err });
    return { status: "unknown" };
  }
}
