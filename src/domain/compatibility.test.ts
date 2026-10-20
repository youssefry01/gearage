import { describe, expect, it } from "vitest";
import {
  analyzeBuild,
  roleOfCategoryPath,
  type BuildPart,
  type PartRole,
  type RuleId,
} from "./compatibility";

/** A known-good mid-range AM5 gaming build. */
const goodBuild = (): BuildPart[] => [
  { role: "cpu", specs: { socket: "AM5", tdp_w: 65 } },
  {
    role: "motherboard",
    specs: {
      socket: "AM5",
      form_factor: "ATX",
      memory_type: "DDR5",
      memory_slots: 4,
      max_memory_gb: 192,
      m2_slots: 3,
    },
  },
  { role: "ram", specs: { memory_type: "DDR5", capacity_gb: 32, modules: 2 } },
  { role: "gpu", specs: { tdp_w: 115, length_mm: 240, recommended_psu_w: 550 } },
  { role: "psu", specs: { wattage_w: 650, form_factor: "ATX" } },
  {
    role: "case",
    specs: {
      form_factors: ["ATX", "mATX", "Mini-ITX"],
      max_gpu_length_mm: 360,
      max_cooler_height_mm: 165,
      psu_form_factors: ["ATX"],
      radiator_support_mm: [240, 280],
    },
  },
  {
    role: "cooler",
    specs: {
      cooler_type: "air",
      sockets: ["AM4", "AM5", "LGA1700"],
      height_mm: 155,
      tdp_rating_w: 180,
    },
  },
  { role: "storage", specs: { interface: "NVMe", form_factor: "M.2 2280" } },
];

/** Replaces the specs of one role (merging) and returns the new build. */
function patch(role: PartRole, specs: Record<string, unknown>, quantity?: number): BuildPart[] {
  return goodBuild().map((p) =>
    p.role === role
      ? { ...p, specs: { ...p.specs, ...specs }, ...(quantity ? { quantity } : {}) }
      : p,
  );
}
const without = (role: PartRole) => goodBuild().filter((p) => p.role !== role);
const failing = (parts: BuildPart[]) =>
  analyzeBuild(parts)
    .issues.filter((i) => i.severity === "fail")
    .map((i) => i.rule);
const rules = (parts: BuildPart[]) =>
  analyzeBuild(parts).issues.map((i) => `${i.rule}:${i.severity}`);

describe("a known-good build", () => {
  const report = analyzeBuild(goodBuild());
  it("is compatible and strictly OK, with every rule having run and passed", () => {
    expect(report.compatible).toBe(true);
    expect(report.strictOk).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.passed).toHaveLength(12);
  });
  it("estimates power draw and recommends headroom", () => {
    expect(report.estimatedWatts).toBe(65 + 115 + 100);
    expect(report.recommendedWatts).toBe(550); // max(ceil50(280*1.25)=350, gpu recommended 550)
  });
});

describe("each rule fails on its own", () => {
  const cases: [RuleId, BuildPart[]][] = [
    ["cpu_socket", patch("cpu", { socket: "LGA1700" })],
    ["ram_type", patch("ram", { memory_type: "DDR4" })],
    ["ram_slots", patch("ram", { modules: 2 }, 3)], // 6 sticks into 4 slots
    ["ram_capacity", patch("ram", { capacity_gb: 128 }, 2)], // 256 GB over a 192 GB limit
    ["case_form_factor", patch("case", { form_factors: ["Mini-ITX"] })],
    ["gpu_length", patch("gpu", { length_mm: 400 })],
    ["cooler_socket", patch("cooler", { sockets: ["LGA1700"] })],
    ["cooler_fit", patch("cooler", { height_mm: 180 })],
    ["psu_form_factor", patch("psu", { form_factor: "SFX" })],
    ["psu_wattage", patch("psu", { wattage_w: 250 })],
    ["storage_m2_slots", patch("storage", {}, 4)], // 4 M.2 drives, 3 slots
  ];
  it.each(cases)("%s", (rule, parts) => {
    expect(failing(parts)).toEqual([rule]);
    expect(analyzeBuild(parts).compatible).toBe(false);
  });
  it("matching ignores case and spacing: 'lga 1700' equals 'LGA1700'", () => {
    const parts = patch("cpu", { socket: "lga 1700" }).map((p) =>
      p.role === "motherboard" ? { ...p, specs: { ...p.specs, socket: "LGA1700" } } : p,
    );
    expect(failing(parts)).not.toContain("cpu_socket");
  });
});

describe("liquid coolers", () => {
  const aio = (radiator: number) =>
    patch("cooler", { cooler_type: "liquid", radiator_mm: radiator, height_mm: undefined });
  it("fit when the case supports the radiator, fail when it does not", () => {
    expect(failing(aio(240))).toEqual([]);
    expect(failing(aio(360))).toEqual(["cooler_fit"]);
  });
  it("accepts supported sizes stored as numeric strings (spec lists are STRING_LIST)", () => {
    const asStrings = patch("case", { radiator_support_mm: ["240", "360"] });
    const parts = asStrings.map((p) =>
      p.role === "cooler"
        ? { ...p, specs: { ...p.specs, cooler_type: "liquid", radiator_mm: 360 } }
        : p,
    );
    expect(failing(parts)).toEqual([]);
  });
});

describe("PSU wattage thresholds", () => {
  // cpu 65 + gpu 115 + 100 = 280 estimated; recommended = max(ceil50(350) = 350, 550) = 550
  it.each([
    [279, "fail"],
    [280, "warn"],
    [549, "warn"],
    [550, "pass"],
  ])("%iW is %s", (watts, expected) => {
    const found = analyzeBuild(patch("psu", { wattage_w: watts })).issues.find(
      (i) => i.rule === "psu_wattage",
    );
    expect(found?.severity ?? "pass").toBe(expected);
  });
  it("a warning does not make the build incompatible, but is also not a failure for strict checks", () => {
    const r = analyzeBuild(patch("psu", { wattage_w: 450 }));
    expect(r.compatible).toBe(true);
    expect(r.strictOk).toBe(true);
  });
  it("a build without a GPU needs only CPU + platform power", () => {
    const r = analyzeBuild(without("gpu"));
    expect(r.estimatedWatts).toBe(165);
    expect(r.compatible).toBe(true);
  });
});

describe("cooler under-rating", () => {
  it("warns when the cooler is rated below the CPU's TDP", () => {
    expect(rules(patch("cooler", { tdp_rating_w: 45 }))).toEqual(["cooler_tdp:warn"]);
  });
  it("an absent rating is not 'unknown'", () => {
    expect(rules(patch("cooler", { tdp_rating_w: undefined }))).toEqual([]);
  });
});

describe("missing data is unknown, never a false failure", () => {
  it("a missing spec makes the rule 'unknown' and breaks strict mode only", () => {
    const parts = patch("gpu", { length_mm: undefined });
    const r = analyzeBuild(parts);
    expect(rules(parts)).toEqual(["gpu_length:unknown"]);
    expect(r.compatible).toBe(true);
    expect(r.strictOk).toBe(false);
  });
  it("rules whose parts are absent do not run at all", () => {
    const r = analyzeBuild([{ role: "cpu", specs: { socket: "AM5", tdp_w: 65 } }]);
    expect(r.issues).toEqual([]);
    expect(r.passed).toEqual([]);
    expect(r.estimatedWatts).toBe(165);
  });
  it("an empty build is trivially compatible", () => {
    const r = analyzeBuild([]);
    expect(r).toMatchObject({
      compatible: true,
      strictOk: true,
      estimatedWatts: null,
      recommendedWatts: null,
    });
  });
  it("garbage spec values are treated as unknown", () => {
    expect(rules(patch("cpu", { socket: 123 }))).toContain("cpu_socket:unknown");
  });
});

describe("issues carry i18n keys and parameters, never display text", () => {
  it("has a message key and numeric/string params", () => {
    const issue = analyzeBuild(patch("gpu", { length_mm: 400 })).issues[0];
    expect(issue).toMatchObject({
      rule: "gpu_length",
      severity: "fail",
      messageKey: "gpuTooLong",
      params: { gpuMm: 400, maxMm: 360 },
    });
  });
});

describe("roleOfCategoryPath", () => {
  it("maps component category paths to build roles, including nested brand categories", () => {
    expect(roleOfCategoryPath("components/cpus")).toBe("cpu");
    expect(roleOfCategoryPath("components/graphics-cards/nvidia-geforce")).toBe("gpu");
    expect(roleOfCategoryPath("components/cooling/air-coolers")).toBe("cooler");
    expect(roleOfCategoryPath("components/power-supplies")).toBe("psu");
  });
  it("does not treat case fans as coolers", () => {
    expect(roleOfCategoryPath("components/cooling/case-fans")).toBeNull();
  });
  it("is null for everything else, and does not match by loose prefix", () => {
    expect(roleOfCategoryPath("monitors/gaming-monitors")).toBeNull();
    expect(roleOfCategoryPath("components")).toBeNull();
    expect(roleOfCategoryPath("components/cpus-extra")).toBeNull();
  });
});
