import type { SeedBundle, SeedSpecs } from "../types";
import { enumSpec, option, tokens, t } from "./helpers";

/**
 * Bundles hold only EDITORIAL specs. Hardware summaries (CPU, GPU, memory, storage) are derived from the components at
 * read time so they can never drift when a component changes. Every bundle must pass the compatibility rules with no
 * warnings and no unknowns (enforced by tests), and its fixed price must be below the parts total.
 */
export const bundleSpecs: SeedSpecs = {
  "pc-bundles": [
    enumSpec(
      "use_case",
      "Best for",
      "مناسب لـ",
      [
        option("gaming", "Gaming", "الألعاب"),
        option("workstation", "Workstation", "محطة عمل"),
        option("office", "Office and home", "المكتب والمنزل"),
      ],
      { required: true, facet: "CHECKBOX" },
    ),
    enumSpec(
      "target_resolution",
      "Target resolution",
      "الدقة المستهدفة",
      tokens(["1080p", "1440p", "4K"]),
      {
        facet: "CHECKBOX",
      },
    ),
  ],
};

const loose =
  "Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty.";

export const bundles: readonly SeedBundle[] = [
  {
    sku: "BND-BUDGET-1080P",
    category: "pc-bundles/budget-builds",
    title: t(
      "Budget Gaming PC: Ryzen 5 5600 + RTX 4060",
      "تجميعة ألعاب اقتصادية: Ryzen 5 5600 مع RTX 4060",
    ),
    short: t(
      "Everything for a 1080p gaming PC on a sensible budget.",
      "كل ما تحتاجه لجهاز ألعاب بدقة 1080p بميزانية معقولة.",
    ),
    description: t(
      `A balanced AM4 build: a Ryzen 5 5600 (boxed cooler included), a B550 board, 16 GB of DDR4, an RTX 4060, a 1 TB NVMe drive and a 650 W power supply in a compact Micro-ATX case. ${loose}`,
      "تجميعة AM4 متوازنة: معالج Ryzen 5 5600 (المبرد داخل العلبة) ولوحة B550 وذاكرة DDR4 بسعة 16 جيجا وكارت RTX 4060 وقرص NVMe بسعة 1 تيرا ومصدر طاقة 650 واط في صندوق Micro-ATX صغير. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 35000,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-AMD-R5-5600" },
      { sku: "MB-GIGABYTE-B550M-DS3H" },
      { sku: "RAM-KINGSTON-FURY-D4-16G-3200" },
      { sku: "GPU-ASUS-DUAL-RTX4060-O8G" },
      { sku: "SSD-WD-BLUE-SN580-1TB" },
      { sku: "PSU-CORSAIR-CX650" },
      { sku: "CASE-CM-MASTERBOX-Q300L" },
    ],
    views: 3800,
    sold: 47,
    addedDaysAgo: 30,
    tags: ["gaming", "budget", "1080p", "featured"],
    specs: { use_case: "gaming", target_resolution: "1080p" },
    showcase: [
      {
        type: "FEATURE",
        title: t("Why these parts (sample)", "لماذا هذه القطع (مثال)"),
        body: t(
          "Sample copy explaining the build's idea. Replace with real merchandising text.",
          "نص مثال يشرح فكرة التجميعة. استبدله بنص تسويقي حقيقي.",
        ),
      },
    ],
  },
  {
    sku: "BND-MIDRANGE-1440P",
    category: "pc-bundles/gaming-pcs",
    title: t(
      "Mid-Range Gaming PC: Ryzen 5 7600 + RTX 5060 Ti 16GB",
      "تجميعة ألعاب متوسطة: Ryzen 5 7600 مع RTX 5060 Ti سعة 16 جيجا",
    ),
    short: t(
      "A modern AM5 and DDR5 platform with 16 GB of video memory for 1440p.",
      "منصة AM5 وDDR5 حديثة مع 16 جيجا ذاكرة فيديو للعب بدقة 1440p.",
    ),
    description: t(
      `A current-generation build centred on a Ryzen 5 7600 and a 16 GB RTX 5060 Ti, with 32 GB of DDR5-6000, a fast 1 TB NVMe drive, an air cooler and a 750 W Gold power supply in an airflow case. ${loose}`,
      "تجميعة من الجيل الحالي تدور حول معالج Ryzen 5 7600 وكارت RTX 5060 Ti بسعة 16 جيجا مع ذاكرة DDR5-6000 بسعة 32 جيجا وقرص NVMe سريع بسعة 1 تيرا ومبرد هوائي ومصدر طاقة 750 واط Gold في صندوق جيد التهوية. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 63500,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-AMD-R5-7600" },
      { sku: "MB-MSI-PRO-B650M-A-WIFI" },
      { sku: "RAM-KINGSTON-FURY-D5-32G-6000" },
      { sku: "GPU-GIGABYTE-RTX5060TI-WF-16G" },
      { sku: "SSD-WD-BLACK-SN850X-1TB" },
      { sku: "COOL-DEEPCOOL-AK400" },
      { sku: "PSU-CORSAIR-RM750E" },
      { sku: "CASE-NZXT-H5-FLOW" },
    ],
    views: 6200,
    sold: 31,
    addedDaysAgo: 25,
    tags: ["gaming", "featured", "1440p"],
    specs: { use_case: "gaming", target_resolution: "1440p" },
  },
  {
    sku: "BND-PERFORMANCE-INTEL-1440P",
    category: "pc-bundles/gaming-pcs",
    title: t(
      "Performance Gaming PC: Core i5-14400F + RX 9070 XT",
      "تجميعة ألعاب عالية الأداء: Core i5-14400F مع RX 9070 XT",
    ),
    short: t(
      "Intel and Radeon for high-refresh 1440p, on a DDR4 platform that keeps the price down.",
      "إنتل مع رايدن للعب بمعدل تحديث عالٍ بدقة 1440p على منصة DDR4 تحافظ على السعر.",
    ),
    description: t(
      `A Core i5-14400F (boxed cooler included) on a Micro-ATX B760 board with 32 GB of DDR4, paired with a 16 GB RX 9070 XT, a 1 TB NVMe drive and an 850 W Gold power supply in a roomy case. ${loose}`,
      "معالج Core i5-14400F (المبرد داخل العلبة) على لوحة B760 بحجم Micro-ATX مع ذاكرة DDR4 بسعة 32 جيجا، مع كارت RX 9070 XT بسعة 16 جيجا وقرص NVMe بسعة 1 تيرا ومصدر طاقة 850 واط Gold في صندوق واسع. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 73500,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-INT-I5-14400F" },
      { sku: "MB-MSI-PRO-B760M-A-WIFI-DDR4" },
      { sku: "RAM-CORSAIR-LPX-D4-32G-3200" },
      { sku: "GPU-GIGABYTE-RX9070XT-GAMING-OC-16G" },
      { sku: "SSD-SAMSUNG-990EVO-1TB" },
      { sku: "PSU-MSI-MAG-A850GL-PCIE5" },
      { sku: "CASE-LIANLI-LANCOOL-216" },
    ],
    views: 3300,
    sold: 14,
    addedDaysAgo: 20,
    tags: ["gaming", "1440p"],
    specs: { use_case: "gaming", target_resolution: "1440p" },
  },
  {
    sku: "BND-HIGHEND-4K",
    category: "pc-bundles/gaming-pcs",
    title: t(
      "High-End Gaming PC: Ryzen 7 7800X3D + RTX 5080",
      "تجميعة ألعاب فاخرة: Ryzen 7 7800X3D مع RTX 5080",
    ),
    short: t(
      "Top gaming CPU, a 16 GB RTX 5080 and a 360 mm liquid cooler for 4K.",
      "أفضل معالج للألعاب مع كارت RTX 5080 بسعة 16 جيجا ومبرد مائي 360 مم للعب بدقة 4K.",
    ),
    description: t(
      `A no-compromise gaming build: the Ryzen 7 7800X3D, an RTX 5080 Founders Edition, 32 GB of low-latency DDR5-6000, a 2 TB PCIe 4.0 drive, a 360 mm liquid cooler and a 1000 W Gold power supply. ${loose}`,
      "تجميعة ألعاب بلا تنازلات: معالج Ryzen 7 7800X3D وكارت RTX 5080 Founders Edition وذاكرة DDR5-6000 منخفضة زمن الاستجابة بسعة 32 جيجا وقرص PCIe 4.0 بسعة 2 تيرا ومبرد مائي 360 مم ومصدر طاقة 1000 واط Gold. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 143500,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-AMD-R7-7800X3D" },
      { sku: "MB-MSI-MAG-B650-TOMAHAWK-WIFI" },
      { sku: "RAM-CORSAIR-VENGEANCE-D5-32G-6000" },
      { sku: "GPU-NVIDIA-RTX5080-FE" },
      { sku: "SSD-SAMSUNG-990PRO-2TB" },
      { sku: "COOL-CM-MASTERLIQUID-ML360L-V2" },
      { sku: "PSU-MSI-MPG-A1000G-PCIE5" },
      { sku: "CASE-CORSAIR-4000D-AIRFLOW" },
    ],
    views: 7400,
    sold: 9,
    addedDaysAgo: 18,
    tags: ["gaming", "high-end", "4k", "featured"],
    specs: { use_case: "gaming", target_resolution: "4K" },
  },
  {
    sku: "BND-WORKSTATION-CREATOR",
    category: "pc-bundles/workstations",
    title: t(
      "Creator Workstation: Ryzen 9 9950X + 64GB + RTX 5070",
      "محطة عمل للمبدعين: Ryzen 9 9950X مع 64 جيجا وRTX 5070",
    ),
    short: t(
      "16 cores, 64 GB of memory and two fast NVMe drives for rendering and editing.",
      "16 نواة وذاكرة 64 جيجا وقرصا NVMe سريعان للريندر والمونتاج.",
    ),
    description: t(
      `Built for rendering, compiling and editing: a Ryzen 9 9950X with a dual-tower air cooler, 64 GB of DDR5, an RTX 5070, a 2 TB system drive plus a 1 TB scratch drive and an 850 W Gold power supply. ${loose}`,
      "مبنية للريندر والبرمجة والمونتاج: معالج Ryzen 9 9950X مع مبرد هوائي ببرجين وذاكرة DDR5 بسعة 64 جيجا وكارت RTX 5070 وقرص نظام بسعة 2 تيرا مع قرص عمل بسعة 1 تيرا ومصدر طاقة 850 واط Gold. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 120000,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-AMD-R9-9950X" },
      { sku: "MB-ASUS-TUF-B650-PLUS-WIFI" },
      { sku: "RAM-CORSAIR-VENGEANCE-D5-64G-5600" },
      { sku: "GPU-ASUS-PRIME-RTX5070-O12G" },
      { sku: "SSD-SAMSUNG-990PRO-2TB" },
      { sku: "SSD-SAMSUNG-990EVO-1TB" },
      { sku: "COOL-NOCTUA-NH-D15" },
      { sku: "PSU-MSI-MAG-A850GL-PCIE5" },
      { sku: "CASE-CORSAIR-4000D-AIRFLOW" },
    ],
    views: 2600,
    sold: 5,
    addedDaysAgo: 22,
    tags: ["workstation", "creator", "high-end"],
    specs: { use_case: "workstation" },
  },
  {
    sku: "BND-OFFICE-HOME",
    category: "pc-bundles/office-pcs",
    title: t(
      "Office & Home PC: Ryzen 5 7600 with Integrated Graphics",
      "تجميعة مكتب ومنزل: Ryzen 5 7600 برسوميات مدمجة",
    ),
    short: t(
      "A quiet, efficient PC for work, study and everyday use. No graphics card needed.",
      "جهاز هادئ وموفر للطاقة للعمل والدراسة والاستخدام اليومي. لا يحتاج كارت شاشة.",
    ),
    description: t(
      `A Ryzen 5 7600 with built-in graphics and its boxed cooler, 16 GB of DDR5, a 1 TB NVMe drive and a 550 W power supply in a compact Micro-ATX case. ${loose}`,
      "معالج Ryzen 5 7600 برسوميات مدمجة ومبرده داخل العلبة، مع ذاكرة DDR5 بسعة 16 جيجا وقرص NVMe بسعة 1 تيرا ومصدر طاقة 550 واط في صندوق Micro-ATX صغير. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص.",
    ),
    fixedPriceEgp: 25500,
    warrantyMonths: 12,
    items: [
      { sku: "CPU-AMD-R5-7600" },
      { sku: "MB-MSI-PRO-B650M-A-WIFI" },
      { sku: "RAM-KINGSTON-FURY-D5-16G-5600" },
      { sku: "SSD-WD-BLUE-SN580-1TB" },
      { sku: "PSU-CM-MWE-BRONZE-550-V2" },
      { sku: "CASE-CM-MASTERBOX-Q300L" },
    ],
    views: 2100,
    sold: 22,
    addedDaysAgo: 28,
    tags: ["office", "compact", "quiet", "budget"],
    specs: { use_case: "office" },
  },
];
