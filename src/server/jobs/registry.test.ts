import { describe, expect, it, vi } from "vitest";
import { runJobs } from "@/server/jobs/registry";

vi.mock("@/server/services/inventory.service", () => ({
  expireReservations: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/server/services/search.service", () => ({
  runSearchIndexRebuild: vi.fn().mockResolvedValue(undefined),
  pruneOldZeroResults: vi.fn().mockResolvedValue(0),
}));

describe("runJobs", () => {
  it("runs the jobs of the requested cadence and reports results", async () => {
    const tick = await runJobs("tick");
    expect(tick.length).toBeGreaterThan(0);
    expect(tick.every((r) => r.ok)).toBe(true);
    const daily = await runJobs("daily");
    expect(daily.map((r) => r.name)).toEqual(["rebuild-search-index", "prune-search-zero-results"]);
    expect(daily.every((r) => r.ok)).toBe(true);
  });

  it("is safe to run twice (idempotency contract)", async () => {
    const a = await runJobs("tick");
    const b = await runJobs("tick");
    expect(b.map((r) => r.name)).toEqual(a.map((r) => r.name));
  });
});
