import { z } from "zod";

/**
 * Editable store details kept in the StoreSetting table (key "contact"), so the owner can change them without a
 * deploy. Admin editing UI lands in M11; reading with safe defaults is available now. Every field is optional.
 */
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Invalid phone number");

/** https only: blocks javascript: and other schemes from ever reaching an href. */
const httpsUrl = z.url({ protocol: /^https$/ }).max(300);

export const contactSettingsSchema = z
  .object({
    email: z.email().max(254).nullable().default(null),
    phone: phone.nullable().default(null),
    /** Digits for wa.me links (country code first). */
    whatsapp: phone.nullable().default(null),
    /** Postal address per locale code, e.g. { en: "...", ar: "..." }. */
    address: z.record(z.string(), z.string().trim().max(300)).default({}),
    social: z
      .object({
        facebook: httpsUrl.nullable().default(null),
        instagram: httpsUrl.nullable().default(null),
        x: httpsUrl.nullable().default(null),
        youtube: httpsUrl.nullable().default(null),
        tiktok: httpsUrl.nullable().default(null),
        linkedin: httpsUrl.nullable().default(null),
      })
      .default({
        facebook: null,
        instagram: null,
        x: null,
        youtube: null,
        tiktok: null,
        linkedin: null,
      }),
  })
  .strict();

export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export const CONTACT_SETTINGS_KEY = "contact";

export const defaultContactSettings: ContactSettings = contactSettingsSchema.parse({});
