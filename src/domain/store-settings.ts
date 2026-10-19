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

/**
 * Top-bar information lines (e.g. a delivery or payment promise). DELIBERATELY EMPTY by default: claims such as
 * delivery coverage must not be hardcoded, so the bar stays neutral until the owner sets real values (StoreSetting
 * key "topbar"). Each line carries text per locale; a line with no text for the active locale or the fallback is skipped.
 */
export const TOP_BAR_SETTINGS_KEY = "topbar";
export const TOP_BAR_ICONS = ["info", "truck", "banknote", "shield"] as const;
export type TopBarIcon = (typeof TOP_BAR_ICONS)[number];

export const topBarSettingsSchema = z
  .object({
    lines: z
      .array(
        z.object({
          icon: z.enum(TOP_BAR_ICONS).default("info"),
          text: z
            .record(z.string(), z.string().trim().min(1).max(120))
            .refine((t) => Object.keys(t).length > 0, "At least one language is required"),
        }),
      )
      .max(3)
      .default([]),
  })
  .strict();

export type TopBarSettings = z.infer<typeof topBarSettingsSchema>;
export const defaultTopBarSettings: TopBarSettings = topBarSettingsSchema.parse({});

export type TopBarLine = { icon: TopBarIcon; text: string };

export function resolveTopBarLines(
  settings: TopBarSettings,
  locale: string,
  fallbackLocale = "en",
): TopBarLine[] {
  return settings.lines.flatMap((line) => {
    const text = line.text[locale] ?? line.text[fallbackLocale];
    return text ? [{ icon: line.icon, text }] : [];
  });
}
