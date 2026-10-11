import { getDb } from "@/server/db";

/** Cheapest possible round-trip to prove the pooled connection works. */
export async function pingDatabase(): Promise<void> {
  await getDb().$queryRaw`SELECT 1`;
}
