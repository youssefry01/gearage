import { normalizeSearchText } from "@/domain/search-normalize";

/**
 * Search vocabulary (ADR 0019): groups of words that mean the same thing to a shopper in Egypt. A query word that is
 * a member of a group matches every member, in either language. This is what lets "كارت شاشة", "كرت الشاشه",
 * "graphics card" and "GPU" find the same products, and lets "انفيديا" find NVIDIA when a brand has no Arabic name.
 *
 * Members are written naturally and normalized when the module loads (alef forms, ta marbuta, the "ال" prefix...),
 * so "لوحة أم" and "لوحه ام" are the same member. A phrase may be up to SYNONYM_MAX_TOKENS words.
 *
 * Every Arabic spelling here is machine-written and NEEDS NATIVE REVIEW (docs/I18N_REVIEW.md lists them). Known
 * limitation: the Arabic spelling of the brand Gigabyte is also how "gigabyte" (the unit) is transliterated; it is
 * treated as the brand, and the unit is written "جيجا".
 */
export const SYNONYM_MAX_TOKENS = 4;

export type SynonymGroup = { id: string; terms: readonly string[] };

const g = (id: string, ...terms: string[]): SynonymGroup => ({ id, terms });

export const SYNONYM_GROUPS: readonly SynonymGroup[] = [
  // --- product types ---------------------------------------------------------------------------------------------
  g(
    "gpu",
    "gpu",
    "graphics card",
    "graphic card",
    "video card",
    "vga",
    "كارت شاشة",
    "كرت شاشة",
    "كروت شاشة",
    "كروت الشاشة",
    "كارت جرافيك",
    "كرت جرافيك",
    "كروت جرافيك",
    "جرافيك",
    "كارت فيجا",
    "كرت فيجا",
  ),
  g(
    "cpu",
    "cpu",
    "processor",
    "processors",
    "معالج",
    "معالجات",
    "المعالج",
    "المعالجات",
    "بروسيسور",
    "بروسسور",
  ),
  g(
    "motherboard",
    "motherboard",
    "motherboards",
    "mobo",
    "mainboard",
    "لوحة أم",
    "لوحة الأم",
    "لوحات أم",
    "لوحات الأم",
    "اللوحة الأم",
    "اللوحات الأم",
    "مازر بورد",
    "مازربورد",
    "ماذر بورد",
    "ماذربورد",
    "مذربورد",
  ),
  g(
    "ram",
    "ram",
    "memory",
    "memories",
    "رام",
    "ذاكرة",
    "ذاكرة عشوائية",
    "ذاكرة رام",
    "الذاكرة العشوائية",
    "ميموري",
  ),
  g(
    "storage",
    "storage",
    "hard drive",
    "hard disk",
    "hdd",
    "هارد",
    "هارد ديسك",
    "هارد درايف",
    "هاردسك",
    "تخزين",
    "وحدات تخزين",
    "وحدة تخزين",
  ),
  g("ssd", "ssd", "solid state", "solid state drive", "اس اس دي"),
  g("nvme", "nvme", "ان في ام اي"),
  g(
    "psu",
    "psu",
    "power supply",
    "power supplies",
    "مصدر طاقة",
    "مصادر طاقة",
    "مصدر الطاقة",
    "مصادر الطاقة",
    "باور",
    "باور سبلاي",
    "باور سابلاي",
    "بور سبلاي",
    "باور سوبلاي",
  ),
  g(
    "case",
    "case",
    "pc case",
    "computer case",
    "صندوق كمبيوتر",
    "صناديق كمبيوتر",
    "صندوق الكمبيوتر",
    "صناديق الكمبيوتر",
    "كيس",
    "كيسة",
    "كيس كمبيوتر",
  ),
  g(
    "liquid-cooler",
    "liquid cooler",
    "water cooler",
    "aio",
    "مبرد مائي",
    "كولر مائي",
    "تبريد مائي",
    "ليكويد",
  ),
  g(
    "cooler",
    "cooler",
    "coolers",
    "cooling",
    "fan",
    "fans",
    "مبرد",
    "مبردات",
    "تبريد",
    "كولر",
    "مروحة",
    "مراوح",
    "فان",
  ),
  g("monitor", "monitor", "monitors", "display", "screen", "شاشة", "شاشات", "مونيتور", "مونيتر"),
  g("laptop", "laptop", "laptops", "notebook", "notebooks", "لابتوب", "لابتوبات", "لاب توب", "لاب"),
  g("ultrabook", "ultrabook", "ultrabooks", "ألترابوك", "الترا بوك"),
  g(
    "keyboard",
    "keyboard",
    "keyboards",
    "كيبورد",
    "كيبوردات",
    "كي بورد",
    "لوحة مفاتيح",
    "لوحات مفاتيح",
  ),
  g("mouse", "mouse", "mice", "ماوس", "ماوسات", "فأرة", "فأرات", "فارة"),
  g("mouse-pad", "mouse pad", "mousepad", "ماوس باد", "ماوسباد"),
  g(
    "headset",
    "headset",
    "headsets",
    "headphone",
    "headphones",
    "هيدسيت",
    "هيدفون",
    "سماعة",
    "سماعات",
    "سماعة رأس",
    "سماعات رأس",
  ),
  g(
    "webcam",
    "webcam",
    "webcams",
    "web cam",
    "camera",
    "كاميرا ويب",
    "كاميرات الويب",
    "ويب كام",
    "ويبكام",
    "كاميرا",
  ),
  g("microphone", "microphone", "mic", "ميكروفون", "مايكروفون", "مايك", "ميك"),
  g("router", "router", "routers", "راوتر", "راوترات", "روتر"),
  g("switch", "network switch", "switch", "switches", "سويتش", "سوتش"),
  g("wifi", "wifi", "wi fi", "واي فاي", "وايفاي"),
  g("thermal-paste", "thermal paste", "thermal compound", "معجون حراري"),
  g("bundle", "bundle", "bundles", "pc build", "pc builds", "تجميعة", "تجميعات", "جهاز كامل"),
  g("workstation", "workstation", "workstations", "محطة عمل", "محطات عمل"),
  g("gaming", "gaming", "gamer", "game", "games", "ألعاب", "للألعاب", "جيمنج", "جيمينج", "قيمنج"),
  g("office", "office", "مكتب", "مكتبي", "أوفيس"),
  // --- units: spoken Arabic units appear in Arabic titles, the Latin symbols in the specs ---------------------------
  g("gb", "gb", "جيجا"),
  g("tb", "tb", "تيرا", "تيرابايت", "terabyte"),
  g("hz", "hz", "هرتز"),
  g("watt", "watt", "watts", "w", "واط"),
  // --- brands: no brand has an Arabic name in the catalog yet, so these are what Arabic shoppers type ---------------
  g("brand-nvidia", "nvidia", "انفيديا", "إنفيديا", "نفيديا"),
  g("brand-geforce", "geforce", "جيفورس", "جي فورس"),
  g("brand-rtx", "rtx", "ار تي اكس"),
  g("brand-radeon", "radeon", "ريديون", "راديون"),
  g("brand-amd", "amd", "ايه ام دي", "اي ام دي"),
  g("brand-ryzen", "ryzen", "ريزن", "رايزن", "ريزين"),
  g("brand-intel", "intel", "انتل", "إنتل"),
  g("brand-asus", "asus", "ايسوس", "اسوس", "أسوس", "ايزوس"),
  g("brand-msi", "msi", "ام اس اي"),
  g("brand-gigabyte", "gigabyte", "جيجابايت", "جيجابيت"),
  g("brand-corsair", "corsair", "كورسير", "كورسايير"),
  g("brand-kingston", "kingston", "كينجستون", "كنجستون", "كينغستون"),
  g("brand-samsung", "samsung", "سامسونج", "سامسونغ"),
  g("brand-wd", "wd", "western digital", "ويسترن ديجيتال", "دبليو دي"),
  g("brand-cooler-master", "cooler master", "coolermaster", "كولر ماستر"),
  g("brand-nzxt", "nzxt", "ان زد اكس تي"),
  g("brand-logitech", "logitech", "لوجيتك", "لوجيتيك", "لوجيتش"),
  g("brand-lenovo", "lenovo", "لينوفو", "لينوفا"),
  g("brand-lg", "lg", "ال جي"),
  g("brand-tp-link", "tp link", "tplink", "تي بي لينك", "تيبي لينك", "تب لينك"),
  g("brand-hyperx", "hyperx", "hyper x", "هايبر اكس"),
  g("brand-redragon", "redragon", "ريدراجون", "ريدراغون", "ريد دراجون"),
  g("brand-noctua", "noctua", "نوكتوا"),
  g("brand-deepcool", "deepcool", "ديب كول", "ديبكول"),
  g("brand-lian-li", "lian li", "lianli", "ليان لي"),
  g("brand-thinkpad", "thinkpad", "ثينك باد", "ثينكباد"),
];

export type NormalizedGroup = { id: string; members: readonly string[] };

/** Normalizes, de-duplicates and indexes groups by every member phrase. Throws when two groups claim a phrase. */
export function buildSynonymIndex(
  groups: readonly SynonymGroup[],
): ReadonlyMap<string, NormalizedGroup> {
  const index = new Map<string, NormalizedGroup>();
  for (const group of groups) {
    const members = [...new Set(group.terms.map(normalizeSearchText).filter((m) => m !== ""))];
    const normalized: NormalizedGroup = { id: group.id, members };
    for (const member of members) {
      const owner = index.get(member);
      if (owner && owner.id !== group.id)
        throw new Error(`Synonym "${member}" is in both "${owner.id}" and "${group.id}"`);
      index.set(member, normalized);
    }
  }
  return index;
}

export const SYNONYM_INDEX: ReadonlyMap<string, NormalizedGroup> =
  buildSynonymIndex(SYNONYM_GROUPS);
