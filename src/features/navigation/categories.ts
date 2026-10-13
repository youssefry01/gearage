import type { Locale } from "@/i18n/locales";

/**
 * TEMPORARY static category tree for the shell. It mirrors the planned taxonomy; in M3a the same shape is served
 * from the database (Category rows with en/ar names) through a cached service, and this file is deleted.
 * Arabic names are machine-written and need native review (HANDOFF known issue 10).
 */
export type NavCategory = {
  slug: string;
  name: { en: string; ar: string };
  children?: NavCategory[];
};

const n = (en: string, ar: string) => ({ en, ar });

export const navCategories: NavCategory[] = [
  {
    slug: "components",
    name: n("Components", "المكونات"),
    children: [
      {
        slug: "cpus",
        name: n("CPUs", "المعالجات"),
        children: [
          { slug: "amd-ryzen", name: n("AMD Ryzen", "AMD Ryzen") },
          { slug: "intel-core", name: n("Intel Core", "Intel Core") },
        ],
      },
      {
        slug: "graphics-cards",
        name: n("Graphics Cards", "كروت الشاشة"),
        children: [
          { slug: "nvidia-geforce", name: n("NVIDIA GeForce", "NVIDIA GeForce") },
          { slug: "amd-radeon", name: n("AMD Radeon", "AMD Radeon") },
          { slug: "intel-arc", name: n("Intel Arc", "Intel Arc") },
        ],
      },
      {
        slug: "motherboards",
        name: n("Motherboards", "اللوحات الأم"),
        children: [
          { slug: "amd-motherboards", name: n("AMD Motherboards", "لوحات AMD الأم") },
          { slug: "intel-motherboards", name: n("Intel Motherboards", "لوحات Intel الأم") },
        ],
      },
      {
        slug: "memory",
        name: n("Memory (RAM)", "الذاكرة العشوائية"),
        children: [
          { slug: "ddr5", name: n("DDR5", "DDR5") },
          { slug: "ddr4", name: n("DDR4", "DDR4") },
        ],
      },
      {
        slug: "storage",
        name: n("Storage", "وحدات التخزين"),
        children: [
          { slug: "nvme-ssds", name: n("NVMe SSDs", "أقراص NVMe") },
          { slug: "sata-ssds", name: n("SATA SSDs", "أقراص SATA") },
          { slug: "hard-drives", name: n("Hard Drives", "الأقراص الصلبة") },
        ],
      },
      { slug: "power-supplies", name: n("Power Supplies", "مصادر الطاقة") },
      { slug: "cases", name: n("Cases", "صناديق الكمبيوتر") },
      {
        slug: "cooling",
        name: n("Cooling", "التبريد"),
        children: [
          { slug: "air-coolers", name: n("Air Coolers", "مبردات هوائية") },
          { slug: "liquid-coolers", name: n("Liquid Coolers", "مبردات مائية") },
          { slug: "case-fans", name: n("Case Fans", "مراوح الصندوق") },
        ],
      },
    ],
  },
  {
    slug: "pc-bundles",
    name: n("PC Bundles", "تجميعات الكمبيوتر"),
    children: [
      { slug: "gaming-pcs", name: n("Gaming PCs", "أجهزة الألعاب") },
      { slug: "workstations", name: n("Workstations", "محطات العمل") },
      { slug: "office-pcs", name: n("Office PCs", "أجهزة المكتب") },
      { slug: "budget-builds", name: n("Budget Builds", "تجميعات اقتصادية") },
    ],
  },
  {
    slug: "laptops",
    name: n("Laptops", "اللابتوب"),
    children: [
      { slug: "gaming-laptops", name: n("Gaming Laptops", "لابتوب الألعاب") },
      { slug: "ultrabooks", name: n("Ultrabooks", "ألترابوك") },
      { slug: "business-laptops", name: n("Business Laptops", "لابتوب الأعمال") },
    ],
  },
  {
    slug: "monitors",
    name: n("Monitors", "الشاشات"),
    children: [
      { slug: "gaming-monitors", name: n("Gaming Monitors", "شاشات الألعاب") },
      { slug: "ultrawide-monitors", name: n("Ultrawide Monitors", "شاشات عريضة") },
      { slug: "office-monitors", name: n("Office Monitors", "شاشات المكتب") },
      { slug: "4k-monitors", name: n("4K Monitors", "شاشات 4K") },
    ],
  },
  {
    slug: "peripherals",
    name: n("Peripherals", "الملحقات الطرفية"),
    children: [
      { slug: "keyboards", name: n("Keyboards", "لوحات المفاتيح") },
      { slug: "mice", name: n("Mice", "الفأرات") },
      { slug: "headsets", name: n("Headsets", "سماعات الرأس") },
      { slug: "webcams", name: n("Webcams", "كاميرات الويب") },
    ],
  },
  {
    slug: "networking",
    name: n("Networking", "الشبكات"),
    children: [
      { slug: "routers", name: n("Routers", "الراوترات") },
      { slug: "wifi-adapters", name: n("Wi-Fi Adapters", "كروت الواي فاي") },
      { slug: "network-switches", name: n("Network Switches", "سويتشات الشبكة") },
    ],
  },
];

export const categoryName = (c: NavCategory, locale: Locale): string =>
  (c.name as Record<string, string>)[locale] ?? c.name.en;

/** Locale-less URL path of a category, given its slug trail: ["components", "cpus"] -> "/c/components/cpus". */
export const categoryPath = (trail: readonly string[]): string => `/c/${trail.join("/")}`;

/** Resolves a slug trail to its node and the nodes on the way (for breadcrumbs). Undefined when not found. */
export function findCategory(
  trail: readonly string[],
): { node: NavCategory; chain: NavCategory[] } | undefined {
  const chain: NavCategory[] = [];
  let level: NavCategory[] | undefined = navCategories;
  for (const slug of trail) {
    const next: NavCategory | undefined = level?.find((c) => c.slug === slug);
    if (!next) return undefined;
    chain.push(next);
    level = next.children;
  }
  const node = chain.at(-1);
  return node ? { node, chain } : undefined;
}

/** Every category slug trail, depth-first. Used for static generation and tests. */
export function allCategoryTrails(
  nodes: NavCategory[] = navCategories,
  prefix: string[] = [],
): string[][] {
  return nodes.flatMap((c) => [
    [...prefix, c.slug],
    ...allCategoryTrails(c.children ?? [], [...prefix, c.slug]),
  ]);
}
