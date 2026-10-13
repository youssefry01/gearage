import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkReadiness } from "@/server/services/health.service";
import {
  getSystemStatus,
  PROBE_TIMEOUT_MS,
  resetStatusCacheForTests,
  STATUS_TTL_MS,
} from "./status.service";

vi.mock("@/server/services/health.service", () => ({ checkReadiness: vi.fn() }));
const readiness = vi.mocked(checkReadiness);

describe("getSystemStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStatusCacheForTests();
    readiness.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("is operational when the database answers quickly", async () => {
    readiness.mockResolvedValue({ db: "up", latencyMs: 12 });
    const s = await getSystemStatus();
    expect(s.overall).toBe("operational");
    expect(s.components).toEqual({
      website: "operational",
      api: "operational",
      database: "operational",
    });
  });

  it("is degraded when the database is slow, down when it is not reachable", async () => {
    readiness.mockResolvedValue({ db: "up", latencyMs: 4000 });
    expect((await getSystemStatus()).components.database).toBe("degraded");
    resetStatusCacheForTests();
    readiness.mockResolvedValue({ db: "down", latencyMs: 5 });
    const s = await getSystemStatus();
    expect(s.components.database).toBe("down");
    expect(s.overall).toBe("down");
  });

  it("treats a hung probe as down instead of hanging", async () => {
    readiness.mockReturnValue(new Promise(() => undefined));
    const pending = getSystemStatus();
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 1);
    expect((await pending).components.database).toBe("down");
  });

  it("treats a throwing probe as down", async () => {
    readiness.mockRejectedValue(new Error("boom: password=hunter2"));
    const s = await getSystemStatus();
    expect(s.components.database).toBe("down");
    expect(JSON.stringify(s)).not.toContain("hunter2");
  });

  it("caches for the TTL, then refreshes", async () => {
    readiness.mockResolvedValue({ db: "up", latencyMs: 1 });
    await getSystemStatus();
    await getSystemStatus();
    expect(readiness).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(STATUS_TTL_MS + 1);
    await getSystemStatus();
    expect(readiness).toHaveBeenCalledTimes(2);
  });

  it("shares ONE probe between concurrent callers (single-flight)", async () => {
    readiness.mockResolvedValue({ db: "up", latencyMs: 1 });
    await Promise.all(Array.from({ length: 25 }, () => getSystemStatus()));
    expect(readiness).toHaveBeenCalledTimes(1);
  });

  it("exposes only coarse fields: no latency, host or error text", async () => {
    readiness.mockResolvedValue({ db: "up", latencyMs: 777 });
    const json = JSON.stringify(await getSystemStatus());
    expect(json).not.toContain("777");
    expect(Object.keys(JSON.parse(json) as object).sort()).toEqual([
      "checkedAt",
      "components",
      "overall",
    ]);
  });
});
