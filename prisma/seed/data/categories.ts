import type { SeedCategory } from "../types";
import { t } from "./helpers";

/**
 * Category tree, parents before children (sibling order = display order). Depth is at most 3. The same shape the
 * storefront navigation uses; M3a serves the menu from these rows. Arabic names are machine-written (native review).
 */
export const categories: readonly SeedCategory[] = [
  // 1. Components
  {
    path: "components",
    name: t("Components", "المكونات"),
    description: t(
      "Everything inside the PC: processors, graphics cards, motherboards, memory, storage, power, cases and cooling.",
      "كل ما بداخل الكمبيوتر: المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين والطاقة والصناديق والتبريد.",
    ),
  },
  { path: "components/cpus", name: t("CPUs", "المعالجات") },
  { path: "components/cpus/amd-ryzen", name: t("AMD Ryzen", "AMD Ryzen") },
  { path: "components/cpus/intel-core", name: t("Intel Core", "Intel Core") },
  { path: "components/graphics-cards", name: t("Graphics Cards", "كروت الشاشة") },
  { path: "components/graphics-cards/nvidia-geforce", name: t("NVIDIA GeForce", "NVIDIA GeForce") },
  { path: "components/graphics-cards/amd-radeon", name: t("AMD Radeon", "AMD Radeon") },
  { path: "components/graphics-cards/intel-arc", name: t("Intel Arc", "Intel Arc") },
  { path: "components/motherboards", name: t("Motherboards", "اللوحات الأم") },
  {
    path: "components/motherboards/amd-motherboards",
    name: t("AMD Motherboards", "لوحات AMD الأم"),
  },
  {
    path: "components/motherboards/intel-motherboards",
    name: t("Intel Motherboards", "لوحات Intel الأم"),
  },
  { path: "components/memory", name: t("Memory (RAM)", "الذاكرة العشوائية") },
  { path: "components/memory/ddr5", name: t("DDR5", "DDR5") },
  { path: "components/memory/ddr4", name: t("DDR4", "DDR4") },
  { path: "components/storage", name: t("Storage", "وحدات التخزين") },
  { path: "components/storage/nvme-ssds", name: t("NVMe SSDs", "أقراص NVMe") },
  { path: "components/storage/sata-ssds", name: t("SATA SSDs", "أقراص SATA") },
  { path: "components/storage/hard-drives", name: t("Hard Drives", "الأقراص الصلبة") },
  { path: "components/power-supplies", name: t("Power Supplies", "مصادر الطاقة") },
  { path: "components/cases", name: t("Cases", "صناديق الكمبيوتر") },
  { path: "components/cooling", name: t("Cooling", "التبريد") },
  { path: "components/cooling/air-coolers", name: t("Air Coolers", "مبردات هوائية") },
  { path: "components/cooling/liquid-coolers", name: t("Liquid Coolers", "مبردات مائية") },
  { path: "components/cooling/case-fans", name: t("Case Fans", "مراوح الصندوق") },

  // 2. PC bundles
  {
    path: "pc-bundles",
    name: t("PC Bundles", "تجميعات الكمبيوتر"),
    description: t(
      "Curated sets of compatible parts sold together at one price.",
      "مجموعات مختارة من القطع المتوافقة تُباع معاً بسعر واحد.",
    ),
  },
  { path: "pc-bundles/gaming-pcs", name: t("Gaming PCs", "أجهزة الألعاب") },
  { path: "pc-bundles/workstations", name: t("Workstations", "محطات العمل") },
  { path: "pc-bundles/office-pcs", name: t("Office PCs", "أجهزة المكتب") },
  { path: "pc-bundles/budget-builds", name: t("Budget Builds", "تجميعات اقتصادية") },

  // 3. Laptops
  { path: "laptops", name: t("Laptops", "اللابتوب") },
  { path: "laptops/gaming-laptops", name: t("Gaming Laptops", "لابتوب الألعاب") },
  { path: "laptops/ultrabooks", name: t("Ultrabooks", "ألترابوك") },
  { path: "laptops/business-laptops", name: t("Business Laptops", "لابتوب الأعمال") },

  // 4. Monitors
  { path: "monitors", name: t("Monitors", "الشاشات") },
  { path: "monitors/gaming-monitors", name: t("Gaming Monitors", "شاشات الألعاب") },
  { path: "monitors/ultrawide-monitors", name: t("Ultrawide Monitors", "شاشات عريضة") },
  { path: "monitors/office-monitors", name: t("Office Monitors", "شاشات المكتب") },
  { path: "monitors/4k-monitors", name: t("4K Monitors", "شاشات 4K") },

  // 5. Peripherals
  { path: "peripherals", name: t("Peripherals", "الملحقات الطرفية") },
  { path: "peripherals/keyboards", name: t("Keyboards", "لوحات المفاتيح") },
  { path: "peripherals/mice", name: t("Mice", "الفأرات") },
  { path: "peripherals/headsets", name: t("Headsets", "سماعات الرأس") },
  { path: "peripherals/webcams", name: t("Webcams", "كاميرات الويب") },

  // 6. Networking
  { path: "networking", name: t("Networking", "الشبكات") },
  { path: "networking/routers", name: t("Routers", "الراوترات") },
  { path: "networking/wifi-adapters", name: t("Wi-Fi Adapters", "كروت الواي فاي") },
  { path: "networking/network-switches", name: t("Network Switches", "سويتشات الشبكة") },

  // 7. Audio & streaming
  { path: "audio-streaming", name: t("Audio & Streaming", "الصوتيات والبث") },
  { path: "audio-streaming/microphones", name: t("Microphones", "الميكروفونات") },

  // 8. Accessories
  { path: "accessories", name: t("Accessories", "الإكسسوارات") },
  { path: "accessories/thermal-paste", name: t("Thermal Paste", "معجون حراري") },
  { path: "accessories/mouse-pads", name: t("Mouse Pads", "ماوس باد") },

  // 9. Gift cards: reserved for the later digital-products phase, hidden until it ships.
  { path: "gift-cards", name: t("Gift Cards", "بطاقات الهدايا"), active: false },
];
