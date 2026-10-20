import type { SeedProduct, SeedSpecs } from "../../types";
import { boolSpec, enumSpec, listSpec, numberSpec, tokens, t } from "../helpers";

export const audioAccessorySpecs: SeedSpecs = {
  "audio-streaming/microphones": [
    enumSpec("connection", "Connection", "الاتصال", tokens(["USB", "XLR"]), {
      required: true,
      facet: "CHECKBOX",
    }),
    listSpec("polar_patterns", "Pickup patterns", "أنماط الالتقاط", { facet: "CHECKBOX" }),
    boolSpec("rgb", "RGB lighting", "إضاءة RGB", { filter: true }),
  ],
  "accessories/thermal-paste": [
    numberSpec("quantity_g", "Amount", "الكمية", { unit: "g", required: true, min: 0.1 }),
    boolSpec("electrically_conductive", "Electrically conductive", "موصل للكهرباء"),
  ],
  "accessories/mouse-pads": [
    enumSpec("surface", "Surface", "السطح", tokens(["Cloth", "Hard"]), {
      required: true,
      facet: "CHECKBOX",
    }),
  ],
};

export const audioAccessories: readonly SeedProduct[] = [
  {
    sku: "MIC-HYPERX-QUADCAST-S",
    brand: "hyperx",
    category: "audio-streaming/microphones",
    model: "QuadCast S",
    title: t(
      "HyperX QuadCast S USB Condenser Microphone",
      "ميكروفون HyperX QuadCast S USB كوندنسر",
    ),
    short: t(
      "USB condenser microphone with four pickup patterns and RGB lighting for streaming.",
      "ميكروفون كوندنسر USB بأربعة أنماط التقاط وإضاءة RGB للبث.",
    ),
    priceEgp: 5400,
    warrantyMonths: 24,
    stock: 9,
    views: 2700,
    sold: 118,
    addedDaysAgo: 180,
    tags: ["streaming", "rgb", "creator"],
    specs: {
      connection: "USB",
      polar_patterns: ["Stereo", "Omnidirectional", "Cardioid", "Bidirectional"],
      rgb: true,
    },
  },
  {
    sku: "MIC-LOGITECH-BLUE-YETI",
    brand: "logitech",
    category: "audio-streaming/microphones",
    model: "Blue Yeti",
    title: t("Logitech Blue Yeti USB Microphone", "ميكروفون Logitech Blue Yeti USB"),
    short: t(
      "Well-known USB microphone with multiple pickup patterns for podcasts and calls.",
      "ميكروفون USB معروف بأنماط التقاط متعددة للبودكاست والمكالمات.",
    ),
    priceEgp: 4800,
    compareAtEgp: 5600,
    warrantyMonths: 24,
    stock: 12,
    views: 2400,
    sold: 156,
    addedDaysAgo: 220,
    tags: ["streaming", "creator"],
    specs: {
      connection: "USB",
      polar_patterns: ["Stereo", "Omnidirectional", "Cardioid", "Bidirectional"],
      rgb: false,
    },
  },
  {
    sku: "ACC-NOCTUA-NT-H1-3G5",
    brand: "noctua",
    category: "accessories/thermal-paste",
    model: "NT-H1 3.5g",
    title: t("Noctua NT-H1 Thermal Compound (3.5g)", "معجون حراري Noctua NT-H1 (3.5 جم)"),
    short: t(
      "High-quality, non-conductive thermal paste enough for several CPU installs.",
      "معجون حراري عالي الجودة غير موصل للكهرباء يكفي لعدة تركيبات للمعالج.",
    ),
    priceEgp: 420,
    warrantyMonths: 0,
    stock: 70,
    views: 900,
    sold: 330,
    addedDaysAgo: 250,
    tags: ["budget"],
    specs: { quantity_g: 3.5, electrically_conductive: false },
  },
  {
    sku: "ACC-LOGITECH-G640",
    brand: "logitech",
    category: "accessories/mouse-pads",
    model: "G640",
    title: t(
      "Logitech G640 Large Cloth Gaming Mouse Pad",
      "ماوس باد Logitech G640 كبير قماشي للألعاب",
    ),
    short: t(
      "Large cloth mouse pad with a consistent surface for precise tracking.",
      "ماوس باد قماشي كبير بسطح ثابت لتتبع دقيق.",
    ),
    priceEgp: 1200,
    warrantyMonths: 12,
    stock: 18,
    views: 800,
    sold: 140,
    addedDaysAgo: 240,
    tags: ["gaming"],
    lengthMm: 460,
    widthMm: 400,
    heightMm: 3,
    specs: { surface: "Cloth" },
    verify: {
      keys: ["lengthMm", "widthMm"],
      note: "Dimensions (460 x 400 x 3 mm) are from memory of the manufacturer's page.",
    },
  },
];
