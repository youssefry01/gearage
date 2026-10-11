import {
  CONTACT_SETTINGS_KEY,
  contactSettingsSchema,
  defaultContactSettings,
  type ContactSettings,
} from "@/domain/store-settings";
import { logger } from "@/lib/logger";
import { readSetting } from "@/server/repositories/store-settings.repository";

/**
 * Contact and social details for footer, contact page, emails and JSON-LD. Never throws: a missing row, invalid JSON
 * or an unreachable database falls back to empty defaults so pages keep rendering (the DB is not required to boot).
 */
export async function getContactSettings(): Promise<ContactSettings> {
  try {
    const raw = await readSetting(CONTACT_SETTINGS_KEY);
    if (raw === null) return defaultContactSettings;
    const parsed = contactSettingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    logger.warn("contact_settings_invalid", {
      issues: parsed.error.issues.map((i) => i.path.join(".")),
    });
  } catch (err) {
    logger.warn("contact_settings_unavailable", { err });
  }
  return defaultContactSettings;
}
