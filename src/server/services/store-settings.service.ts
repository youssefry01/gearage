import type { ZodType } from "zod";
import {
  CONTACT_SETTINGS_KEY,
  TOP_BAR_SETTINGS_KEY,
  contactSettingsSchema,
  defaultContactSettings,
  defaultTopBarSettings,
  topBarSettingsSchema,
  type ContactSettings,
  type TopBarSettings,
} from "@/domain/store-settings";
import { logger } from "@/lib/logger";
import { readSetting } from "@/server/repositories/store-settings.repository";

const WARN_EVERY_MS = 60_000;
const lastWarnAt = new Map<string, number>();

/** Static generation calls these once per page; warn at most once a minute per setting and never with a stack trace. */
function warnThrottled(key: string, msg: string, fields: Record<string, unknown>): void {
  const now = Date.now();
  if (now - (lastWarnAt.get(key) ?? 0) < WARN_EVERY_MS) return;
  lastWarnAt.set(key, now);
  logger.warn(msg, { setting: key, ...fields });
}

export function resetStoreSettingsWarningsForTests(): void {
  lastWarnAt.clear();
}

/**
 * Reads one StoreSetting row and validates it. Never throws: a missing row, invalid JSON or an unreachable database
 * falls back to `fallback` so pages keep rendering (the DB is not required to boot). No DATABASE_URL at all (CI builds)
 * is an expected state and falls back quietly.
 */
async function readValidated<T>(key: string, schema: ZodType<T>, fallback: T): Promise<T> {
  if (!process.env.DATABASE_URL) {
    logger.debug("store_setting_skipped_no_database", { setting: key });
    return fallback;
  }
  try {
    const raw = await readSetting(key);
    if (raw === null) return fallback;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    warnThrottled(key, "store_setting_invalid", {
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
  } catch (err) {
    warnThrottled(key, "store_setting_unavailable", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
  return fallback;
}

/** Contact and social details for footer, contact page, emails and JSON-LD. */
export const getContactSettings = (): Promise<ContactSettings> =>
  readValidated(CONTACT_SETTINGS_KEY, contactSettingsSchema, defaultContactSettings);

/** Top-bar information lines. Empty (neutral) until the owner configures them. */
export const getTopBarSettings = (): Promise<TopBarSettings> =>
  readValidated(TOP_BAR_SETTINGS_KEY, topBarSettingsSchema, defaultTopBarSettings);
