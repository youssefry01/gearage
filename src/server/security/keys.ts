import { createHmac, hkdfSync } from "node:crypto";
import { getEnv } from "@/lib/env";

/** Fixed, public salt for HKDF (the secret is AUTH_SECRET; a salt only domain-separates). */
const HKDF_SALT = Buffer.from("hkdf-salt-v1");

/**
 * A 32-byte key for one purpose, derived from AUTH_SECRET with HKDF-SHA256. One secret in the environment, many
 * independent keys: leaking what one purpose reveals tells nothing about another. `context` narrows a purpose, for
 * example the UTC day for the view-tracking visitor key (so that key rotates daily).
 */
export function deriveKey(
  purpose: string,
  context = "",
  secret: string = getEnv().AUTH_SECRET,
): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, `${purpose}\u0000${context}`, 32));
}

/** HMAC-SHA256 (hex) of `value` under the key for `purpose`. Used to store identifiers (IP, email) without storing them. */
export function hmacHex(purpose: string, value: string, context = ""): string {
  return createHmac("sha256", deriveKey(purpose, context)).update(value).digest("hex");
}
