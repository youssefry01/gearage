/**
 * PC build compatibility rules. PURE and shared by three consumers: bundle pages (compatibility badge), the PC Builder
 * (M10b) and the seed test that every seeded bundle must pass. It reads only product SPECS, using the spec keys below
 * (they are the canonical SpecDefinition keys of each category), and returns i18n message KEYS plus parameters, never
 * display text, so the UI translates them.
 *
 * Spec keys per role:
 *   cpu         socket, tdp_w
 *   motherboard socket, form_factor, memory_type, memory_slots, max_memory_gb, m2_slots
 *   ram         memory_type, capacity_gb (whole KIT), modules (sticks in the kit); part quantity = number of kits
 *   gpu         tdp_w (board power), length_mm, recommended_psu_w (optional)
 *   psu         wattage_w, form_factor
 *   case        form_factors (list), max_gpu_length_mm, max_cooler_height_mm, psu_form_factors (list), radiator_support_mm (list)
 *   cooler      cooler_type ("air" | "liquid"), sockets (list), height_mm (air), radiator_mm (liquid), tdp_rating_w (optional)
 *   storage     interface ("NVMe" | "SATA"), form_factor ("M.2 2280", "2.5", ...)
 *
 * A rule only runs when both parts it compares are present. If a part is present but a spec it needs is missing, the
 * rule reports "unknown" (never a false failure). `compatible` means no failures; `strictOk` also demands no unknowns,
 * which is what seeded bundles must satisfy.
 */
export const PART_ROLES = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "psu",
  "case",
  "cooler",
  "storage",
] as const;
export type PartRole = (typeof PART_ROLES)[number];

export type BuildPart = {
  role: PartRole;
  quantity?: number;
  specs: Readonly<Record<string, unknown>>;
};

export type RuleId =
  | "cpu_socket"
  | "ram_type"
  | "ram_slots"
  | "ram_capacity"
  | "case_form_factor"
  | "gpu_length"
  | "cooler_socket"
  | "cooler_fit"
  | "cooler_tdp"
  | "psu_form_factor"
  | "psu_wattage"
  | "storage_m2_slots";

export type Severity = "fail" | "warn" | "unknown";
export type CompatIssue = {
  rule: RuleId;
  severity: Severity;
  /** i18n key under `Compatibility.` (messages arrive with the bundle page). */
  messageKey: string;
  params: Record<string, string | number>;
};

export type CompatibilityReport = {
  compatible: boolean;
  strictOk: boolean;
  issues: CompatIssue[];
  /** Rules that ran and passed. */
  passed: RuleId[];
  estimatedWatts: number | null;
  recommendedWatts: number | null;
};

/** Platform allowance (board, RAM, storage, fans) added to CPU + GPU power, and the PSU headroom factor. */
export const BASE_SYSTEM_WATTS = 100;
export const PSU_HEADROOM = 1.25;
const roundUpTo50 = (n: number) => Math.ceil(n / 50) * 50;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")
    ? (v as string[]).map((s) => s.trim())
    : null;
/** Numeric list. Spec values can only be STRING_LIST (ADR 0009), so integers stored as strings ("360") are accepted too. */
const numList = (v: unknown): number[] | null => {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out = v.map((x) =>
    typeof x === "number"
      ? x
      : typeof x === "string" && /^\d+(\.\d+)?$/.test(x.trim())
        ? Number(x)
        : NaN,
  );
  return out.every((n) => Number.isFinite(n)) ? out : null;
};
/** "LGA 1700", "lga1700" and "LGA1700" are the same socket. */
const key = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

type Outcome =
  { status: "skip" } | { status: "pass" } | { status: "issue"; issue: Omit<CompatIssue, "rule"> };
const SKIP: Outcome = { status: "skip" };
const PASS: Outcome = { status: "pass" };
const issue = (
  severity: Severity,
  messageKey: string,
  params: Record<string, string | number> = {},
): Outcome => ({
  status: "issue",
  issue: { severity, messageKey, params },
});
const unknown = (what: string): Outcome => issue("unknown", "unknownSpec", { spec: what });

type Ctx = {
  first: (role: PartRole) => BuildPart | undefined;
  all: (role: PartRole) => BuildPart[];
  units: (role: PartRole) => number;
};

const RULES: { id: RuleId; run: (c: Ctx) => Outcome }[] = [
  {
    id: "cpu_socket",
    run: (c) => {
      const cpu = c.first("cpu"),
        mb = c.first("motherboard");
      if (!cpu || !mb) return SKIP;
      const a = str(cpu.specs["socket"]),
        b = str(mb.specs["socket"]);
      if (!a || !b) return unknown("socket");
      return key(a) === key(b)
        ? PASS
        : issue("fail", "cpuSocketMismatch", { cpu: a, motherboard: b });
    },
  },
  {
    id: "ram_type",
    run: (c) => {
      const ram = c.first("ram"),
        mb = c.first("motherboard");
      if (!ram || !mb) return SKIP;
      const a = str(ram.specs["memory_type"]),
        b = str(mb.specs["memory_type"]);
      if (!a || !b) return unknown("memory_type");
      return key(a) === key(b)
        ? PASS
        : issue("fail", "ramTypeMismatch", { ram: a, motherboard: b });
    },
  },
  {
    id: "ram_slots",
    run: (c) => {
      const mb = c.first("motherboard");
      if (!mb || c.all("ram").length === 0) return SKIP;
      const slots = num(mb.specs["memory_slots"]);
      const used = c
        .all("ram")
        .map((r) => ({ modules: num(r.specs["modules"]), kits: r.quantity ?? 1 }));
      if (slots === null || used.some((u) => u.modules === null)) return unknown("memory_slots");
      const total = used.reduce((s, u) => s + (u.modules as number) * u.kits, 0);
      return total <= slots ? PASS : issue("fail", "ramSlotsExceeded", { modules: total, slots });
    },
  },
  {
    id: "ram_capacity",
    run: (c) => {
      const mb = c.first("motherboard");
      if (!mb || c.all("ram").length === 0) return SKIP;
      const max = num(mb.specs["max_memory_gb"]);
      const caps = c
        .all("ram")
        .map((r) => ({ gb: num(r.specs["capacity_gb"]), kits: r.quantity ?? 1 }));
      if (max === null || caps.some((x) => x.gb === null)) return unknown("max_memory_gb");
      const total = caps.reduce((s, x) => s + (x.gb as number) * x.kits, 0);
      return total <= max ? PASS : issue("fail", "ramCapacityExceeded", { gb: total, maxGb: max });
    },
  },
  {
    id: "case_form_factor",
    run: (c) => {
      const mb = c.first("motherboard"),
        pcCase = c.first("case");
      if (!mb || !pcCase) return SKIP;
      const ff = str(mb.specs["form_factor"]),
        supported = strList(pcCase.specs["form_factors"]);
      if (!ff || !supported) return unknown("form_factor");
      return supported.some((s) => key(s) === key(ff))
        ? PASS
        : issue("fail", "caseFormFactorUnsupported", {
            motherboard: ff,
            supported: supported.join(", "),
          });
    },
  },
  {
    id: "gpu_length",
    run: (c) => {
      const gpu = c.first("gpu"),
        pcCase = c.first("case");
      if (!gpu || !pcCase) return SKIP;
      const len = num(gpu.specs["length_mm"]),
        max = num(pcCase.specs["max_gpu_length_mm"]);
      if (len === null || max === null) return unknown("length_mm");
      return len <= max ? PASS : issue("fail", "gpuTooLong", { gpuMm: len, maxMm: max });
    },
  },
  {
    id: "cooler_socket",
    run: (c) => {
      const cpu = c.first("cpu"),
        cooler = c.first("cooler");
      if (!cpu || !cooler) return SKIP;
      const socket = str(cpu.specs["socket"]),
        sockets = strList(cooler.specs["sockets"]);
      if (!socket || !sockets) return unknown("sockets");
      return sockets.some((s) => key(s) === key(socket))
        ? PASS
        : issue("fail", "coolerSocketUnsupported", { cpu: socket });
    },
  },
  {
    id: "cooler_fit",
    run: (c) => {
      const cooler = c.first("cooler"),
        pcCase = c.first("case");
      if (!cooler || !pcCase) return SKIP;
      const type = str(cooler.specs["cooler_type"]);
      if (!type) return unknown("cooler_type");
      if (key(type) === "liquid") {
        const radiator = num(cooler.specs["radiator_mm"]),
          supported = numList(pcCase.specs["radiator_support_mm"]);
        if (radiator === null || !supported) return unknown("radiator_mm");
        return supported.includes(radiator)
          ? PASS
          : issue("fail", "radiatorUnsupported", { radiatorMm: radiator });
      }
      const height = num(cooler.specs["height_mm"]),
        max = num(pcCase.specs["max_cooler_height_mm"]);
      if (height === null || max === null) return unknown("height_mm");
      return height <= max
        ? PASS
        : issue("fail", "coolerTooTall", { coolerMm: height, maxMm: max });
    },
  },
  {
    id: "cooler_tdp",
    run: (c) => {
      const cpu = c.first("cpu"),
        cooler = c.first("cooler");
      if (!cpu || !cooler) return SKIP;
      const rating = num(cooler.specs["tdp_rating_w"]);
      if (rating === null) return SKIP; // optional spec: absence is not "unknown"
      const tdp = num(cpu.specs["tdp_w"]);
      if (tdp === null) return unknown("tdp_w");
      return rating >= tdp
        ? PASS
        : issue("warn", "coolerUnderRated", { cpuW: tdp, ratingW: rating });
    },
  },
  {
    id: "psu_form_factor",
    run: (c) => {
      const psu = c.first("psu"),
        pcCase = c.first("case");
      if (!psu || !pcCase) return SKIP;
      const ff = str(psu.specs["form_factor"]),
        supported = strList(pcCase.specs["psu_form_factors"]);
      if (!ff || !supported) return unknown("psu_form_factors");
      return supported.some((s) => key(s) === key(ff))
        ? PASS
        : issue("fail", "psuFormFactorUnsupported", { psu: ff });
    },
  },
  {
    id: "psu_wattage",
    run: (c) => {
      const psu = c.first("psu"),
        cpu = c.first("cpu");
      if (!psu || !cpu) return SKIP;
      const watts = num(psu.specs["wattage_w"]),
        cpuW = num(cpu.specs["tdp_w"]);
      const gpu = c.first("gpu");
      const gpuW = gpu ? num(gpu.specs["tdp_w"]) : 0;
      if (watts === null || cpuW === null || gpuW === null) return unknown("wattage_w");
      const estimated = cpuW + gpuW + BASE_SYSTEM_WATTS;
      const gpuRecommended = gpu ? (num(gpu.specs["recommended_psu_w"]) ?? 0) : 0;
      const recommended = Math.max(roundUpTo50(estimated * PSU_HEADROOM), gpuRecommended);
      if (watts < estimated)
        return issue("fail", "psuInsufficient", { psuW: watts, estimatedW: estimated });
      if (watts < recommended)
        return issue("warn", "psuBelowRecommended", { psuW: watts, recommendedW: recommended });
      return PASS;
    },
  },
  {
    id: "storage_m2_slots",
    run: (c) => {
      const mb = c.first("motherboard");
      const m2 = c.all("storage").filter((s) => {
        const ff = str(s.specs["form_factor"]);
        return ff !== null && key(ff).startsWith("m.2");
      });
      if (!mb || m2.length === 0) return SKIP;
      const slots = num(mb.specs["m2_slots"]);
      if (slots === null) return unknown("m2_slots");
      const used = m2.reduce((s, p) => s + (p.quantity ?? 1), 0);
      return used <= slots ? PASS : issue("fail", "m2SlotsExceeded", { drives: used, slots });
    },
  },
];

/** Runs every rule over a set of parts. */
export function analyzeBuild(parts: readonly BuildPart[]): CompatibilityReport {
  const ctx: Ctx = {
    first: (role) => parts.find((p) => p.role === role),
    all: (role) => parts.filter((p) => p.role === role),
    units: (role) =>
      parts.filter((p) => p.role === role).reduce((s, p) => s + (p.quantity ?? 1), 0),
  };

  const issues: CompatIssue[] = [];
  const passed: RuleId[] = [];
  for (const rule of RULES) {
    const outcome = rule.run(ctx);
    if (outcome.status === "pass") passed.push(rule.id);
    else if (outcome.status === "issue") issues.push({ rule: rule.id, ...outcome.issue });
  }

  const cpu = ctx.first("cpu"),
    gpu = ctx.first("gpu");
  const cpuW = cpu ? num(cpu.specs["tdp_w"]) : null;
  const gpuW = gpu ? num(gpu.specs["tdp_w"]) : 0;
  const estimatedWatts = cpuW !== null && gpuW !== null ? cpuW + gpuW + BASE_SYSTEM_WATTS : null;
  const gpuRec = gpu ? (num(gpu.specs["recommended_psu_w"]) ?? 0) : 0;

  return {
    compatible: !issues.some((i) => i.severity === "fail"),
    strictOk: issues.every((i) => i.severity === "warn"),
    issues,
    passed,
    estimatedWatts,
    recommendedWatts:
      estimatedWatts === null ? null : Math.max(roundUpTo50(estimatedWatts * PSU_HEADROOM), gpuRec),
  };
}

const ROLE_PREFIXES: readonly (readonly [string, PartRole])[] = [
  ["components/cpus", "cpu"],
  ["components/graphics-cards", "gpu"],
  ["components/motherboards", "motherboard"],
  ["components/memory", "ram"],
  ["components/storage", "storage"],
  ["components/power-supplies", "psu"],
  ["components/cases", "case"],
  ["components/cooling", "cooler"],
];

/** Parts under a build-role prefix that are NOT build parts (case fans carry no cooler specs). Checked first. */
const NON_BUILD_PREFIXES: readonly string[] = ["components/cooling/case-fans"];

/** Which build role a category path ("components/cpus/amd-ryzen") plays, or null for non-build categories. */
export function roleOfCategoryPath(path: string): PartRole | null {
  if (NON_BUILD_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  const hit = ROLE_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}
