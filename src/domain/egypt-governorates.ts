/**
 * The 27 governorates of Egypt (M5b-2c, ADR 0029). Static data, not a table: the list changes by decree, a few times a
 * decade at most, and every consumer (the address form, shipping zones in M6a, the order snapshot in M6b) needs it
 * at once and without a query. The `code` is the stable key stored on addresses and used by shipping zones; the names
 * are for display only and never stored. A new governorate is one line here (plus a test update).
 *
 * The Arabic names are the official ones; they are on the native-review list like all Arabic copy (docs/I18N_REVIEW.md).
 */
export const GOVERNORATES = [
  { code: "cairo", en: "Cairo", ar: "القاهرة" },
  { code: "giza", en: "Giza", ar: "الجيزة" },
  { code: "alexandria", en: "Alexandria", ar: "الإسكندرية" },
  { code: "qalyubia", en: "Qalyubia", ar: "القليوبية" },
  { code: "port-said", en: "Port Said", ar: "بورسعيد" },
  { code: "suez", en: "Suez", ar: "السويس" },
  { code: "dakahlia", en: "Dakahlia", ar: "الدقهلية" },
  { code: "sharqia", en: "Sharqia", ar: "الشرقية" },
  { code: "gharbia", en: "Gharbia", ar: "الغربية" },
  { code: "monufia", en: "Monufia", ar: "المنوفية" },
  { code: "beheira", en: "Beheira", ar: "البحيرة" },
  { code: "kafr-el-sheikh", en: "Kafr El Sheikh", ar: "كفر الشيخ" },
  { code: "damietta", en: "Damietta", ar: "دمياط" },
  { code: "ismailia", en: "Ismailia", ar: "الإسماعيلية" },
  { code: "fayoum", en: "Fayoum", ar: "الفيوم" },
  { code: "beni-suef", en: "Beni Suef", ar: "بني سويف" },
  { code: "minya", en: "Minya", ar: "المنيا" },
  { code: "asyut", en: "Asyut", ar: "أسيوط" },
  { code: "sohag", en: "Sohag", ar: "سوهاج" },
  { code: "qena", en: "Qena", ar: "قنا" },
  { code: "luxor", en: "Luxor", ar: "الأقصر" },
  { code: "aswan", en: "Aswan", ar: "أسوان" },
  { code: "red-sea", en: "Red Sea", ar: "البحر الأحمر" },
  { code: "new-valley", en: "New Valley", ar: "الوادي الجديد" },
  { code: "matrouh", en: "Matrouh", ar: "مطروح" },
  { code: "north-sinai", en: "North Sinai", ar: "شمال سيناء" },
  { code: "south-sinai", en: "South Sinai", ar: "جنوب سيناء" },
] as const;

export type GovernorateCode = (typeof GOVERNORATES)[number]["code"];

export const GOVERNORATE_CODES = GOVERNORATES.map((g) => g.code) as [
  GovernorateCode,
  ...GovernorateCode[],
];

export function isGovernorateCode(value: string): value is GovernorateCode {
  return (GOVERNORATE_CODES as readonly string[]).includes(value);
}

/** Display name in a language; falls back to the code for an unknown one (never throws on stored data). */
export function governorateName(code: string, locale: "en" | "ar"): string {
  const found = GOVERNORATES.find((g) => g.code === code);
  return found ? found[locale] : code;
}

/** The list sorted in the page language (Arabic collation for Arabic), for the form's select. */
export function sortedGovernorates(locale: "en" | "ar"): { code: GovernorateCode; name: string }[] {
  const collator = new Intl.Collator(locale === "ar" ? "ar-EG" : "en");
  return GOVERNORATES.map((g) => ({ code: g.code, name: g[locale] })).sort((a, b) =>
    collator.compare(a.name, b.name),
  );
}
