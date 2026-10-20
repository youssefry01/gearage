import type { SeedTag } from "../types";
import { t } from "./helpers";

/** Editorial tags. Best sellers, deals and new arrivals are derived (units sold, compare-at price, creation date). */
export const tags: readonly SeedTag[] = [
  { slug: "featured", name: t("Featured", "مميز") },
  { slug: "gaming", name: t("Gaming", "ألعاب") },
  { slug: "budget", name: t("Budget", "اقتصادي") },
  { slug: "high-end", name: t("High-end", "فئة عليا") },
  { slug: "workstation", name: t("Workstation", "محطات عمل") },
  { slug: "creator", name: t("Content creation", "صناعة المحتوى") },
  { slug: "office", name: t("Office", "مكتبي") },
  { slug: "streaming", name: t("Streaming", "بث") },
  { slug: "rgb", name: t("RGB", "إضاءة RGB") },
  { slug: "wireless", name: t("Wireless", "لاسلكي") },
  { slug: "quiet", name: t("Quiet", "هادئ") },
  { slug: "compact", name: t("Compact", "صغير الحجم") },
  { slug: "wifi", name: t("Wi-Fi", "واي فاي") },
  { slug: "previous-gen", name: t("Previous generation", "الجيل السابق") },
  { slug: "1080p", name: t("1080p", "1080p") },
  { slug: "1440p", name: t("1440p", "1440p") },
  { slug: "4k", name: t("4K", "4K") },
];
