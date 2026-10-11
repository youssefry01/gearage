import { timingSafeEqual, createHash } from "node:crypto";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. Hashing first equalizes lengths. */
export function isValidCronRequest(authorization: string | null, secret: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(provided), digest(secret));
}
