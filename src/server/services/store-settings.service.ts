import {
  CONTACT_SETTINGS_KEY,
  contactSettingsSchema,
  defaultContactSettings,
  type ContactSettings,
} from "@/domain/store-settings";
import { logger } from "@/lib/logger";
import { readSetting } from "@/server/repositories/store-settings.repository";

const WARN_EVERY_MS = 60_000;
let lastWarnAt = 0;

/** Static generation calls this once per page; warn at most once a minute and never with a stack trace. */
function warnThrottled(msg: string, fields: Record<string, unknown>): void {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  logger.warn(msg, fields);
}

export function resetStoreSettingsWarningsForTests(): void {
  lastWarnAt = 0;
}

/**
 * Contact and social details for footer, contact page, emails and JSON-LD. Never throws: a missing row, invalid JSON
 * or an unreachable database falls back to empty defaults so pages keep rendering (the DB is not required to boot).
 * No DATABASE_URL at all (CI builds) is an expected state and falls back quietly.
 */
export async function getContactSettings(): Promise<ContactSettings> {
  if (!process.env.DATABASE_URL) {
    logger.debug("contact_settings_skipped_no_database");
    return defaultContactSettings;
  }
  try {
    const raw = await readSetting(CONTACT_SETTINGS_KEY);
    if (raw === null) return defaultContactSettings;
    const parsed = contactSettingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    warnThrottled("contact_settings_invalid", {
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
  } catch (err) {
    warnThrottled("contact_settings_unavailable", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
  return defaultContactSettings;
}
