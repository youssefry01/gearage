import { createHmac, timingSafeEqual } from "node:crypto";
import { PENDING_VERIFICATION_MINUTES, emailSchema } from "@/domain/auth";

/** Pure half of the pending-verification cookie (no `next/headers`, no environment), so tests and e2e can use it. */
export const PENDING_COOKIE_NAME = "auth.pending";
/** HKDF purpose for the signing key (`deriveKey(PENDING_PURPOSE)`). */
export const PENDING_PURPOSE = "pending-verification";

type Payload = { e: string; x: number };

function sign(body: string, key: Buffer): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

/** Pure: builds the signed cookie value. `key` is injected so tests do not need the environment. */
export function encodePending(email: string, nowMs: number, key: Buffer): string {
  const payload: Payload = { e: email, x: nowMs + PENDING_VERIFICATION_MINUTES * 60_000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

/** Pure: the address in a valid, unexpired value, or null for anything else (tampered, expired, malformed). */
export function decodePending(
  value: string | undefined | null,
  nowMs: number,
  key: Buffer,
): string | null {
  if (!value || value.length > 600) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof payload.e !== "string" || typeof payload.x !== "number") return null;
    if (payload.x <= nowMs) return null;
    const email = emailSchema.safeParse(payload.e);
    return email.success ? email.data : null;
  } catch {
    return null;
  }
}
