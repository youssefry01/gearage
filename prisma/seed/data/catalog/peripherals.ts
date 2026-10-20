import type { SeedProduct, SeedSpecs } from "../../types";
import { boolSpec, enumSpec, listSpec, numberSpec, textSpec, tokens, t } from "../helpers";

export const peripheralSpecs: SeedSpecs = {
  "peripherals/keyboards": [
    enumSpec("form_factor", "Layout", "التخطيط", tokens(["Full-size", "TKL", "75%", "60%"]), {
      required: true,
      facet: "CHECKBOX",
    }),
    enumSpec(
      "switch_type",
      "Switch type",
      "نوع المفاتيح",
      tokens(["Mechanical", "Membrane", "Scissor"]),
      {
        facet: "CHECKBOX",
      },
    ),
    listSpec("connectivity", "Connectivity", "الاتصال", { facet: "CHECKBOX" }),
    enumSpec("backlight", "Backlight", "الإضاءة الخلفية", tokens(["None", "White", "RGB"]), {
      facet: "CHECKBOX",
    }),
  ],
  "peripherals/mice": [
    numberSpec("dpi_max", "Max DPI", "أقصى DPI", { required: true, facet: "RANGE" }),
    listSpec("connectivity", "Connectivity", "الاتصال", { facet: "CHECKBOX" }),
    numberSpec("buttons", "Buttons", "عدد الأزرار", { min: 2, max: 30 }),
    textSpec("sensor", "Sensor", "الحساس"),
  ],
  "peripherals/headsets": [
    listSpec("connectivity", "Connectivity", "الاتصال", { facet: "CHECKBOX" }),
    numberSpec("driver_mm", "Driver size", "حجم السماعة", { unit: "mm" }),
    enumSpec(
      "microphone",
      "Microphone",
      "الميكروفون",
      tokens(["Detachable", "Boom", "Built-in", "None"]),
      {
        facet: "CHECKBOX",
      },
    ),
  ],
  "peripherals/webcams": [
    enumSpec("resolution", "Resolution", "الدقة", tokens(["720p", "1080p", "4K"]), {
      required: true,
      facet: "CHECKBOX",
    }),
    numberSpec("fps", "Frame rate", "معدل الإطارات", { unit: "fps" }),
    boolSpec("autofocus", "Autofocus", "تركيز تلقائي", { filter: true }),
    boolSpec("microphone", "Built-in microphone", "ميكروفون مدمج", { filter: true }),
  ],
};

const note =
  "Peripheral specs vary by regional model and revision. Confirm on the manufacturer's page.";

export const peripherals: readonly SeedProduct[] = [
  {
    sku: "KB-REDRAGON-K552-KUMARA",
    brand: "redragon",
    category: "peripherals/keyboards",
    model: "K552 Kumara",
    title: t(
      "Redragon K552 Kumara Mechanical Gaming Keyboard (TKL)",
      "كيبورد ميكانيكال Redragon K552 Kumara للألعاب (TKL)",
    ),
    short: t(
      "Compact tenkeyless mechanical keyboard that has become a budget classic.",
      "كيبورد ميكانيكال مدمج بدون لوحة أرقام، أصبح اختياراً اقتصادياً كلاسيكياً.",
    ),
    priceEgp: 1150,
    warrantyMonths: 12,
    stock: 50,
    views: 6400,
    sold: 910,
    addedDaysAgo: 250,
    tags: ["gaming", "budget", "rgb", "compact"],
    specs: {
      form_factor: "TKL",
      switch_type: "Mechanical",
      connectivity: ["Wired"],
      backlight: "RGB",
    },
    verify: {
      keys: ["backlight"],
      note: `${note} Several K552 variants exist with single-colour or RGB lighting.`,
    },
  },
  {
    sku: "KB-LOGITECH-MX-KEYS-S",
    brand: "logitech",
    category: "peripherals/keyboards",
    model: "MX Keys S",
    title: t("Logitech MX Keys S Wireless Keyboard", "كيبورد لاسلكي Logitech MX Keys S"),
    short: t(
      "Low-profile wireless keyboard for productivity, with smart backlighting.",
      "كيبورد لاسلكي منخفض الارتفاع للإنتاجية مع إضاءة خلفية ذكية.",
    ),
    priceEgp: 5200,
    warrantyMonths: 24,
    stock: 11,
    views: 2900,
    sold: 84,
    addedDaysAgo: 130,
    tags: ["office", "wireless", "creator"],
    specs: {
      form_factor: "Full-size",
      switch_type: "Scissor",
      connectivity: ["Bluetooth", "Logi Bolt"],
      backlight: "White",
    },
    verify: { keys: ["connectivity"], note },
    showcase: [
      {
        type: "FEATURE",
        title: t("Feature highlight (sample)", "ميزة مميزة (مثال)"),
        body: t(
          "A short, scannable feature statement goes here.",
          "تُكتب هنا عبارة قصيرة وواضحة عن الميزة.",
        ),
      },
      {
        type: "IMAGE_TEXT",
        alt: t("Placeholder artwork for the keyboard showcase", "صورة مؤقتة لعرض الكيبورد"),
        title: t("Sample showcase block", "مثال على فقرة العرض"),
        body: t(
          "Placeholder text. Replace this block with official content from the manufacturer's media kit.",
          "نص مؤقت. استبدل هذه الفقرة بمحتوى رسمي من الحزمة الإعلامية للمصنّع.",
        ),
      },
    ],
  },
  {
    sku: "MOUSE-LOGITECH-G502-HERO",
    brand: "logitech",
    category: "peripherals/mice",
    model: "G502 HERO",
    title: t("Logitech G502 HERO Gaming Mouse", "ماوس ألعاب Logitech G502 HERO"),
    short: t(
      "Popular wired gaming mouse with a 25,600 DPI sensor and tunable weights.",
      "ماوس ألعاب سلكي شهير بحساس 25600 DPI وأوزان قابلة للتعديل.",
    ),
    priceEgp: 2100,
    compareAtEgp: 2500,
    warrantyMonths: 24,
    stock: 31,
    views: 5100,
    sold: 702,
    addedDaysAgo: 245,
    tags: ["gaming", "rgb"],
    specs: {
      dpi_max: 25600,
      connectivity: ["Wired"],
      buttons: 11,
      sensor: "HERO 25K",
    },
    weightGrams: 121,
  },
  {
    sku: "MOUSE-LOGITECH-G305-LIGHTSPEED",
    brand: "logitech",
    category: "peripherals/mice",
    model: "G305 LIGHTSPEED",
    title: t(
      "Logitech G305 LIGHTSPEED Wireless Gaming Mouse",
      "ماوس ألعاب لاسلكي Logitech G305 LIGHTSPEED",
    ),
    short: t(
      "Light wireless gaming mouse with a fast 2.4 GHz connection and long battery life.",
      "ماوس ألعاب لاسلكي خفيف باتصال 2.4 جيجاهرتز سريع وعمر بطارية طويل.",
    ),
    priceEgp: 1800,
    warrantyMonths: 24,
    stock: 26,
    views: 3300,
    sold: 440,
    addedDaysAgo: 240,
    tags: ["gaming", "wireless", "budget"],
    specs: {
      dpi_max: 12000,
      connectivity: ["Wireless 2.4 GHz"],
      buttons: 6,
      sensor: "HERO",
    },
    weightGrams: 99,
  },
  {
    sku: "HS-HYPERX-CLOUD-II",
    brand: "hyperx",
    category: "peripherals/headsets",
    model: "Cloud II",
    title: t("HyperX Cloud II Gaming Headset", "سماعة ألعاب HyperX Cloud II"),
    short: t(
      "Comfortable wired gaming headset with 53 mm drivers and a detachable microphone.",
      "سماعة ألعاب سلكية مريحة بسماعات 53 مم وميكروفون قابل للفصل.",
    ),
    priceEgp: 3900,
    warrantyMonths: 24,
    stock: 17,
    views: 4400,
    sold: 360,
    addedDaysAgo: 235,
    tags: ["gaming"],
    specs: {
      connectivity: ["3.5 mm", "USB sound card"],
      driver_mm: 53,
      microphone: "Detachable",
    },
    verify: { keys: ["connectivity"], note },
  },
  {
    sku: "CAM-LOGITECH-C920-HD-PRO",
    brand: "logitech",
    category: "peripherals/webcams",
    model: "C920 HD Pro",
    title: t("Logitech C920 HD Pro Webcam", "كاميرا ويب Logitech C920 HD Pro"),
    short: t(
      "Full HD 1080p webcam with autofocus and stereo microphones for calls and streaming.",
      "كاميرا ويب Full HD بدقة 1080p مع تركيز تلقائي وميكروفونات ستيريو للمكالمات والبث.",
    ),
    priceEgp: 3200,
    warrantyMonths: 24,
    stock: 19,
    views: 3500,
    sold: 295,
    addedDaysAgo: 250,
    tags: ["streaming", "office"],
    specs: { resolution: "1080p", fps: 30, autofocus: true, microphone: true },
  },
];
