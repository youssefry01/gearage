import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { utc, type Tx } from "@/server/repositories/inventory.repository";

type Db = Tx | ReturnType<typeof getDb>;

export type UserBrief = { id: string; emailVerified: boolean; locale: string; createdAt: Date };

/** The columns the auth service needs about an address, or null. `email` must already be normalized. */
export async function findUserBrief(email: string, db: Db = getDb()): Promise<UserBrief | null> {
  return db.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, locale: true, createdAt: true },
  });
}

// --- Login throttle (ADR 0024) -------------------------------------------------------------------------------------

export type Throttle = { failures: number; lockedUntil: Date | null; lastFailureAt: Date };

export async function getThrottle(key: string, db: Db = getDb()): Promise<Throttle | null> {
  return db.loginThrottle.findUnique({ where: { key } });
}

/**
 * Records one failed sign-in in a single atomic statement and returns the new count. A failure that follows a quiet
 * period longer than `decayBefore` starts a new run at 1, so an old mistake never counts toward a lockout. Concurrent
 * failures each get their own number (the row is locked by the upsert).
 */
export async function bumpFailure(
  key: string,
  now: Date,
  decayBefore: Date,
  db: Db = getDb(),
): Promise<number> {
  const rows = await db.$queryRaw<{ failures: number }[]>(Prisma.sql`
    INSERT INTO "login_throttle" ("key", "failures", "lockedUntil", "lastFailureAt")
    VALUES (${key}, 1, NULL, ${utc(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE WHEN "login_throttle"."lastFailureAt" < ${utc(decayBefore)} THEN 1 ELSE "login_throttle"."failures" + 1 END,
      "lastFailureAt" = ${utc(now)},
      "lockedUntil" = CASE WHEN "login_throttle"."lastFailureAt" < ${utc(decayBefore)} THEN NULL ELSE "login_throttle"."lockedUntil" END
    RETURNING "failures"`);
  return rows[0]?.failures ?? 1;
}

/** Sets the lock. It only ever moves later, so two concurrent failures cannot shorten each other's lock. */
export async function extendLock(key: string, until: Date, db: Db = getDb()): Promise<void> {
  await db.$executeRaw(Prisma.sql`
    UPDATE "login_throttle"
    SET "lockedUntil" = GREATEST(COALESCE("lockedUntil", ${utc(until)}), ${utc(until)})
    WHERE "key" = ${key}`);
}

export async function clearThrottle(key: string, db: Db = getDb()): Promise<void> {
  await db.loginThrottle.deleteMany({ where: { key } });
}

// --- Credentials ---------------------------------------------------------------------------------------------------

export async function getCredentialHash(userId: string, db: Db = getDb()): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  return account?.password ?? null;
}

/** Stores a fresh hash after a login whose old hash used an old pepper or old parameters (ADR 0003). */
export async function replaceCredentialHash(
  userId: string,
  expectedOld: string,
  fresh: string,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  // Compare-and-set: if the password changed in between (a reset), do not overwrite the newer hash.
  const result = await db.account.updateMany({
    where: { userId, providerId: "credential", password: expectedOld },
    data: { password: fresh, updatedAt: now },
  });
  return result.count === 1;
}

// --- Housekeeping --------------------------------------------------------------------------------------------------

export type AuthPruneResult = {
  unverifiedUsers: number;
  verifications: number;
  sessions: number;
  throttles: number;
  securityEvents: number;
  emailChangeRequests: number;
};

/**
 * Deletes what is dead: accounts whose email was never verified, expired one-time values, expired sessions, old
 * throttle rows, expired email-change requests (ADR 0026) and security events past their retention (`eventsBefore`,
 * about 12 months, ADR 0025). Unverified
 * accounts are removed so a squatted address cannot stay claimed (HANDOFF issue 81).
 */
export async function pruneAuthData(
  now: Date,
  unverifiedBefore: Date,
  eventsBefore: Date,
  db: Db = getDb(),
): Promise<AuthPruneResult> {
  const unverifiedUsers = await db.user.deleteMany({
    where: { emailVerified: false, createdAt: { lt: unverifiedBefore } },
  });
  const verifications = await db.verification.deleteMany({ where: { expiresAt: { lt: now } } });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const throttles = await db.loginThrottle.deleteMany({
    where: { lastFailureAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
  });
  const securityEvents = await db.securityEvent.deleteMany({
    where: { createdAt: { lt: eventsBefore } },
  });
  const emailChangeRequests = await db.emailChangeRequest.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return {
    unverifiedUsers: unverifiedUsers.count,
    verifications: verifications.count,
    sessions: sessions.count,
    throttles: throttles.count,
    securityEvents: securityEvents.count,
    emailChangeRequests: emailChangeRequests.count,
  };
}

// --- Password reset ------------------------------------------------------------------------------------------------

/**
 * The account a still-valid reset token belongs to, or null. Read BEFORE the token is consumed so the lockout for that
 * address can be cleared and the reset logged. Better Auth stores the token as `reset-password:<token>` with the user id.
 */
export async function findResetTokenUser(
  token: string,
  now: Date,
  db: Db = getDb(),
): Promise<{ id: string; email: string; locale: string } | null> {
  const row = await db.verification.findFirst({
    where: { identifier: `reset-password:${token}`, expiresAt: { gt: now } },
    select: { value: true },
  });
  if (!row) return null;
  return db.user.findUnique({
    where: { id: row.value },
    select: { id: true, email: true, locale: true },
  });
}

/** Following an emailed link proves the person controls the inbox, so a reset also verifies the address. */
export async function markEmailVerified(email: string, now: Date, db: Db = getDb()): Promise<void> {
  await db.user.updateMany({
    where: { email, emailVerified: false },
    data: { emailVerified: true, updatedAt: now },
  });
}
