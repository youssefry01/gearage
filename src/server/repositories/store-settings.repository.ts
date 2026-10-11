import { getDb } from "@/server/db";

/** Raw JSON for a setting key, or null when it has never been saved. */
export async function readSetting(key: string): Promise<unknown> {
  const row = await getDb().storeSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}
