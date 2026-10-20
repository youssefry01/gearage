import type { SeedProduct, SeedSpecs } from "../../types";
import { boolSpec, enumSpec, numberSpec, tokens, t } from "../helpers";

const wifiStandards = tokens(["Wi-Fi 5", "Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"]);

export const networkingSpecs: SeedSpecs = {
  "networking/routers": [
    enumSpec("wifi_standard", "Wi-Fi standard", "معيار الواي فاي", wifiStandards, {
      required: true,
      facet: "CHECKBOX",
    }),
    numberSpec("max_speed_mbps", "Combined wireless speed", "السرعة اللاسلكية المجمعة", {
      unit: "Mbps",
      facet: "RANGE",
    }),
    enumSpec("bands", "Bands", "النطاقات", tokens(["Dual-band", "Tri-band"]), {
      facet: "CHECKBOX",
    }),
    numberSpec("lan_ports", "LAN ports", "منافذ LAN", { min: 0, max: 16 }),
  ],
  "networking/wifi-adapters": [
    enumSpec("wifi_standard", "Wi-Fi standard", "معيار الواي فاي", wifiStandards, {
      required: true,
      facet: "CHECKBOX",
    }),
    numberSpec("max_speed_mbps", "Combined wireless speed", "السرعة اللاسلكية المجمعة", {
      unit: "Mbps",
    }),
    enumSpec("interface", "Interface", "الواجهة", tokens(["PCIe", "USB"]), { facet: "CHECKBOX" }),
    boolSpec("bluetooth", "Bluetooth", "بلوتوث", { filter: true }),
  ],
  "networking/network-switches": [
    numberSpec("ports", "Ports", "عدد المنافذ", {
      required: true,
      facet: "CHECKBOX",
      min: 2,
      max: 96,
    }),
    enumSpec("speed", "Port speed", "سرعة المنفذ", tokens(["10/100", "Gigabit", "2.5G"]), {
      facet: "CHECKBOX",
    }),
    boolSpec("managed", "Managed", "قابل للإدارة", { filter: true }),
  ],
};

const note =
  "Wireless speed figures are combined theoretical rates on the manufacturer's spec sheet, not real throughput.";

export const networking: readonly SeedProduct[] = [
  {
    sku: "NET-TPLINK-ARCHER-AX55",
    brand: "tp-link",
    category: "networking/routers",
    model: "Archer AX55",
    title: t(
      "TP-Link Archer AX55 AX3000 Wi-Fi 6 Router",
      "راوتر TP-Link Archer AX55 AX3000 واي فاي 6",
    ),
    short: t(
      "Dual-band Wi-Fi 6 router with Gigabit ports for fast home networks.",
      "راوتر واي فاي 6 ثنائي النطاق بمنافذ جيجابت لشبكات منزلية سريعة.",
    ),
    priceEgp: 2600,
    warrantyMonths: 36,
    stock: 23,
    views: 3700,
    sold: 330,
    addedDaysAgo: 200,
    tags: ["wifi", "office"],
    specs: { wifi_standard: "Wi-Fi 6", max_speed_mbps: 3000, bands: "Dual-band", lan_ports: 4 },
    verify: { keys: ["max_speed_mbps"], note },
  },
  {
    sku: "NET-TPLINK-ARCHER-TX20E",
    brand: "tp-link",
    category: "networking/wifi-adapters",
    model: "Archer TX20E",
    title: t(
      "TP-Link Archer TX20E AX1800 Wi-Fi 6 PCIe Adapter",
      "كارت واي فاي TP-Link Archer TX20E AX1800 واي فاي 6 PCIe",
    ),
    short: t(
      "PCIe Wi-Fi 6 card with Bluetooth to add wireless to a desktop PC.",
      "كارت واي فاي 6 بواجهة PCIe مع بلوتوث لإضافة الاتصال اللاسلكي لجهاز مكتبي.",
    ),
    priceEgp: 1300,
    warrantyMonths: 36,
    stock: 29,
    views: 1800,
    sold: 210,
    addedDaysAgo: 210,
    tags: ["wifi", "budget"],
    specs: { wifi_standard: "Wi-Fi 6", max_speed_mbps: 1800, interface: "PCIe", bluetooth: true },
    verify: { keys: ["max_speed_mbps"], note },
  },
  {
    sku: "NET-TPLINK-TL-SG108",
    brand: "tp-link",
    category: "networking/network-switches",
    model: "TL-SG108",
    title: t(
      "TP-Link TL-SG108 8-Port Gigabit Desktop Switch",
      "سويتش TP-Link TL-SG108 بـ 8 منافذ جيجابت",
    ),
    short: t(
      "Plug-and-play 8-port Gigabit switch for home offices and small setups.",
      "سويتش جيجابت بـ 8 منافذ جاهز للاستخدام فوراً للمكاتب المنزلية والتجهيزات الصغيرة.",
    ),
    priceEgp: 750,
    warrantyMonths: 36,
    stock: 41,
    views: 1300,
    sold: 275,
    addedDaysAgo: 260,
    tags: ["budget", "office"],
    specs: { ports: 8, speed: "Gigabit", managed: false },
  },
];
