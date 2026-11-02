/** Pwned Passwords range API helpers (k-anonymity). The network call lives in server/security/hibp.ts. */

/** Only the first five hex characters of the SHA-1 ever leave the server. */
export const HIBP_PREFIX_LENGTH = 5;

const HEX_SHA1 = /^[0-9A-F]{40}$/;

export function splitSha1(hexUpper: string): { prefix: string; suffix: string } {
  if (!HEX_SHA1.test(hexUpper)) throw new Error("expected an upper-case SHA-1 hex digest");
  return {
    prefix: hexUpper.slice(0, HIBP_PREFIX_LENGTH),
    suffix: hexUpper.slice(HIBP_PREFIX_LENGTH),
  };
}

/**
 * How often `suffix` appears in a range response (`SUFFIX:COUNT` per line). With `Add-Padding: true` the service
 * adds fake lines with a count of 0; those never count as a match.
 */
export function breachCount(rangeBody: string, suffix: string): number {
  for (const line of rangeBody.split("\n")) {
    const [candidate, rawCount] = line.trim().split(":");
    if (candidate?.toUpperCase() === suffix) {
      const count = Number(rawCount);
      return Number.isFinite(count) && count > 0 ? count : 0;
    }
  }
  return 0;
}
