import { getDb } from "@/server/db/client";
import { utc } from "@/server/repositories/inventory.repository";

type Db = Pick<ReturnType<typeof getDb>, "$queryRaw" | "$executeRaw">;

/**
 * One atomic statement: start a window at 1, or add 1 to the live window. An expired row restarts in the same
 * statement, so two concurrent hits can never both see "first hit". Returns the count and when the window ends.
 */
export async function hitCounter(
  key: string,
  windowSec: number,
  now: Date,
  db: Db = getDb(),
): Promise<{ count: number; resetAt: Date }> {
  const expiresAt = new Date(now.getTime() + windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "rate_limit_counter" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${utc(expiresAt)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_counter"."expiresAt" <= ${utc(now)} THEN 1 ELSE "rate_limit_counter"."count" + 1 END,
      "expiresAt" = CASE WHEN "rate_limit_counter"."expiresAt" <= ${utc(now)} THEN ${utc(expiresAt)} ELSE "rate_limit_counter"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  const row = rows[0];
  if (!row) throw new Error("rate limit counter returned no row");
  return { count: row.count, resetAt: row.expiresAt };
}

/** Deletes expired counters. Returns how many. */
export async function pruneCounters(now: Date, db: Db = getDb()): Promise<number> {
  return db.$executeRaw`DELETE FROM "rate_limit_counter" WHERE "expiresAt" <= ${utc(now)}`;
}
