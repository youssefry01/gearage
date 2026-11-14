import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { Tx } from "@/server/repositories/inventory.repository";

type Db = Tx | ReturnType<typeof getDb>;

/**
 * Pending email changes (M5b-2a, ADR 0026). Every function that takes a `userId` only ever touches that account's row;
 * the one function keyed by a secret (`takeByCancelHash`) returns nothing but the account id. The code hash and the
 * cancel hash never leave the service layer (they are read here and compared there).
 */

export type PendingRow = {
  id: string;
  newEmail: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
};

export async function getRequest(userId: string, db: Db = getDb()): Promise<PendingRow | null> {
  return db.emailChangeRequest.findUnique({
    where: { userId },
    select: { id: true, newEmail: true, codeHash: true, attempts: true, expiresAt: true },
  });
}

/** Replaces the account's pending request (there is at most one). The caller runs this inside a transaction. */
export async function replaceRequest(
  data: {
    userId: string;
    newEmail: string;
    codeHash: string;
    cancelHash: string;
    expiresAt: Date;
    createdAt: Date;
  },
  db: Db = getDb(),
): Promise<void> {
  await db.emailChangeRequest.deleteMany({ where: { userId: data.userId } });
  await db.emailChangeRequest.create({ data });
}

/** A resend: a new code and a fresh window, the attempt counter back to zero. The cancel link stays the same. */
export async function renewCode(
  userId: string,
  codeHash: string,
  expiresAt: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const result = await db.emailChangeRequest.updateMany({
    where: { userId },
    data: { codeHash, expiresAt, attempts: 0 },
  });
  return result.count === 1;
}

/** One more wrong code, counted atomically. Returns the new count, or null when there is no request any more. */
export async function bumpAttempts(userId: string, db: Db = getDb()): Promise<number | null> {
  const rows = await db.$queryRaw<{ attempts: number }[]>(Prisma.sql`
    UPDATE "email_change_request" SET "attempts" = "attempts" + 1
    WHERE "userId" = ${userId}::uuid
    RETURNING "attempts"`);
  return rows[0]?.attempts ?? null;
}

/** Deletes one request by its id. 1 when this call removed it, 0 when someone else already did (a double submit). */
export async function deleteRequest(id: string, db: Db = getDb()): Promise<number> {
  const result = await db.emailChangeRequest.deleteMany({ where: { id } });
  return result.count;
}

export async function deleteRequestOfUser(userId: string, db: Db = getDb()): Promise<number> {
  const result = await db.emailChangeRequest.deleteMany({ where: { userId } });
  return result.count;
}

/**
 * Removes the request whose cancel token hashes to `cancelHash` and returns whose it was (null if none). One statement,
 * so two clicks on the same link cancel once.
 */
export async function takeByCancelHash(
  cancelHash: string,
  db: Db = getDb(),
): Promise<{ userId: string } | null> {
  const rows = await db.$queryRaw<{ userId: string }[]>(Prisma.sql`
    DELETE FROM "email_change_request" WHERE "cancelHash" = ${cancelHash}
    RETURNING "userId"`);
  return rows[0] ?? null;
}

/** Moves the account to its new address. Throws Prisma's P2002 when another account holds it (unique index). */
export async function updateUserEmail(
  userId: string,
  newEmail: string,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId },
    data: { email: newEmail, emailVerified: true, updatedAt: now },
  });
  return result.count === 1;
}

/**
 * Deletes every password-reset token issued to this account. A link emailed to the OLD address must not keep working
 * after the address changed. Better Auth stores them as identifier `reset-password:<token>`, value = the user id.
 */
export async function deleteResetTokens(userId: string, db: Db = getDb()): Promise<number> {
  const result = await db.verification.deleteMany({
    where: { identifier: { startsWith: "reset-password:" }, value: userId },
  });
  return result.count;
}

// --- Revert window (ADR 0027) ----------------------------------------------------------------------------------------

/**
 * Records the way back for a change that just completed and RESERVES the old address. One reservation per address:
 * a previous row for the same address is replaced, and the account's own reservation of the address it is moving TO
 * is dropped (it holds that address again). The caller runs this inside the transaction that moved the address.
 */
export async function replaceRevert(
  data: {
    userId: string;
    oldEmail: string;
    newEmail: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  },
  db: Db = getDb(),
): Promise<void> {
  await db.emailChangeRevert.deleteMany({
    where: { OR: [{ oldEmail: data.oldEmail }, { userId: data.userId, oldEmail: data.newEmail }] },
  });
  await db.emailChangeRevert.create({ data });
}

/**
 * Is `email` held back for ANOTHER account (a live reservation whose owner is not `exceptUserId`)? An address reserved
 * for the account asking is its own to take back, so it counts as free for that account only.
 */
export async function isReservedForOthers(
  email: string,
  exceptUserId: string | null,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const row = await db.emailChangeRevert.findFirst({
    where: {
      oldEmail: email,
      expiresAt: { gt: now },
      ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  return row !== null;
}

export type RevertRow = { id: string; userId: string; oldEmail: string; newEmail: string };

/**
 * Consumes the live revert whose token hashes to `tokenHash` (one statement: two clicks revert once). Expired rows do
 * not match. Run inside the reverting transaction, so a refusal later in it puts the row back.
 */
export async function takeRevertByHash(
  tokenHash: string,
  now: Date,
  db: Db = getDb(),
): Promise<RevertRow | null> {
  const rows = await db.$queryRaw<RevertRow[]>(Prisma.sql`
    DELETE FROM "email_change_revert" WHERE "tokenHash" = ${tokenHash} AND "expiresAt" > ${now}
    RETURNING "id", "userId", "oldEmail", "newEmail"`);
  return rows[0] ?? null;
}

/** Every revert row of the account (after a revert the account's history is reset: no stale link may work). */
export async function deleteRevertsOfUser(userId: string, db: Db = getDb()): Promise<number> {
  const result = await db.emailChangeRevert.deleteMany({ where: { userId } });
  return result.count;
}

export type UserForNotice = { id: string; email: string; locale: string };

export async function getUserForNotice(
  userId: string,
  db: Db = getDb(),
): Promise<UserForNotice | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, locale: true },
  });
}

/** Does ANOTHER account hold this address? */
export async function emailHeldByOther(
  email: string,
  exceptUserId: string,
  db: Db = getDb(),
): Promise<boolean> {
  const row = await db.user.findFirst({
    where: { email, NOT: { id: exceptUserId } },
    select: { id: true },
  });
  return row !== null;
}

/** Makes the stored password unusable (a hash of a random value nobody knows): the owner must reset it by email. */
export async function setCredentialHash(
  userId: string,
  hash: string,
  now: Date,
  db: Db = getDb(),
): Promise<void> {
  await db.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: hash, updatedAt: now },
  });
}
