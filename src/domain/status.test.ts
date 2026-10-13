import { describe, expect, it } from "vitest";
import {
  deriveOverall,
  parseSystemStatus,
  SLOW_PROBE_MS,
  stateFromProbe,
  worstState,
} from "./status";

describe("status domain", () => {
  it("worstState picks the most severe", () => {
    expect(worstState([])).toBe("operational");
    expect(worstState(["operational", "degraded"])).toBe("degraded");
    expect(worstState(["degraded", "down", "operational"])).toBe("down");
  });
  it("overall is the worst component", () => {
    expect(
      deriveOverall({ website: "operational", api: "operational", database: "operational" }),
    ).toBe("operational");
    expect(
      deriveOverall({ website: "operational", api: "operational", database: "degraded" }),
    ).toBe("degraded");
    expect(deriveOverall({ website: "operational", api: "operational", database: "down" })).toBe(
      "down",
    );
  });
  it("a slow answer is degraded, no answer is down", () => {
    expect(stateFromProbe({ up: true, latencyMs: 20 })).toBe("operational");
    expect(stateFromProbe({ up: true, latencyMs: SLOW_PROBE_MS })).toBe("operational");
    expect(stateFromProbe({ up: true, latencyMs: SLOW_PROBE_MS + 1 })).toBe("degraded");
    expect(stateFromProbe({ up: false, latencyMs: 1 })).toBe("down");
  });
  it("parseSystemStatus accepts the contract and rejects anything else", () => {
    const good = {
      overall: "degraded",
      components: { website: "operational", api: "operational", database: "degraded" },
      checkedAt: "2026-10-11T10:00:00.000Z",
    };
    expect(parseSystemStatus(good)?.overall).toBe("degraded");
    expect(parseSystemStatus({ ...good, overall: "on fire" })).toBeNull();
    expect(parseSystemStatus({ ...good, components: { website: "operational" } })).toBeNull();
    expect(parseSystemStatus(null)).toBeNull();
    expect(parseSystemStatus("up")).toBeNull();
  });
  it("parseSystemStatus drops unknown fields (nothing extra can leak through)", () => {
    const parsed = parseSystemStatus({
      overall: "operational",
      components: {
        website: "operational",
        api: "operational",
        database: "operational",
        secret: "x",
      },
      checkedAt: "t",
      host: "db.internal",
    });
    expect(JSON.stringify(parsed)).not.toContain("db.internal");
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });
});
