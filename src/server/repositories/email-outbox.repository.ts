import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db/client";
import { utc } from "@/server/repositories/inventory.repository";

type Db = Pick<ReturnType<typeof getDb>, "$queryRaw" | "$executeRaw" | "emailOutbox">;

export type OutboxInsert = {
  template: string;
  locale: string;
  toEmail: string;
  payload: Prisma.InputJsonValue;
  nextAttemptAt: Date;
  expiresAt: Date;
  createdAt: Date;
};

export type ClaimedEmail = {
  id: string;
  template: string;
  locale: string;
  toEmail: string;
  payload: unknown;
  attempts: number;
  expiresAt: Date;
};

export async function insertOutbox(row: OutboxInsert, db: Db = getDb()): Promise<string> {
  const created = await db.emailOutbox.create({ data: row, select: { id: true } });
  return created.id;
}

const LEASE_SECONDS = 120;

/**
 * Claims rows that are due (PENDING and ready, or SENDING with an expired lease from a crashed worker), one worker at
 * a time (`FOR UPDATE SKIP LOCKED`), and counts the attempt. `id` narrows it to one row (immediate dispatch).
 */
export async function claimDue(
  now: Date,
  limit: number,
  id?: string,
  db: Db = getDb(),
): Promise<ClaimedEmail[]> {
  const lease = new Date(now.getTime() + LEASE_SECONDS * 1000);
  const rows = await db.$queryRaw<ClaimedEmail[]>`
    UPDATE "email_outbox" SET "status" = 'SENDING', "lockedUntil" = ${utc(lease)}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "email_outbox"
      WHERE (("status" = 'PENDING' AND "nextAttemptAt" <= ${utc(now)})
          OR ("status" = 'SENDING' AND "lockedUntil" <= ${utc(now)}))
        AND (${id ?? null}::uuid IS NULL OR "id" = ${id ?? null}::uuid)
      ORDER BY "nextAttemptAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED)
    RETURNING "id", "template", "locale", "toEmail", "payload", "attempts", "expiresAt"`;
  return rows;
}

export async function markSent(
  id: string,
  messageId: string,
  now: Date,
  db: Db = getDb(),
): Promise<void> {
  await db.$executeRaw`
    UPDATE "email_outbox" SET "status" = 'SENT', "sentAt" = ${utc(now)}, "providerMessageId" = ${messageId},
      "payload" = '{}'::jsonb, "lockedUntil" = NULL, "lastError" = NULL WHERE "id" = ${id}::uuid`;
}

export async function markRetry(
  id: string,
  nextAttemptAt: Date,
  reason: string,
  db: Db = getDb(),
): Promise<void> {
  await db.$executeRaw`
    UPDATE "email_outbox" SET "status" = 'PENDING', "nextAttemptAt" = ${utc(nextAttemptAt)}, "lastError" = ${reason},
      "lockedUntil" = NULL WHERE "id" = ${id}::uuid`;
}

/** Ends a row without sending: FAILED (gave up) or EXPIRED (the code or link is no longer worth sending). Clears the secret. */
export async function markEnded(
  id: string,
  status: "FAILED" | "EXPIRED",
  reason: string,
  db: Db = getDb(),
): Promise<void> {
  await db.$executeRaw`
    UPDATE "email_outbox" SET "status" = ${status}::"EmailOutboxStatus", "payload" = '{}'::jsonb,
      "lockedUntil" = NULL, "lastError" = ${reason} WHERE "id" = ${id}::uuid`;
}

/** Expires every unsent row whose code or link is past its time, so no secret outlives its usefulness. */
export async function expireStale(now: Date, db: Db = getDb()): Promise<number> {
  return db.$executeRaw`
    UPDATE "email_outbox" SET "status" = 'EXPIRED', "payload" = '{}'::jsonb, "lockedUntil" = NULL,
      "lastError" = 'expired before sending'
    WHERE "status" IN ('PENDING', 'SENDING') AND "expiresAt" <= ${utc(now)}`;
}

/** Deletes finished rows older than the cutoff. */
export async function pruneFinished(cutoff: Date, db: Db = getDb()): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "email_outbox"
    WHERE "createdAt" < ${utc(cutoff)} AND "status" IN ('SENT', 'FAILED', 'EXPIRED')`;
}
