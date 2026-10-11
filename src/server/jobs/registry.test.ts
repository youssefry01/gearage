import { describe, expect, it } from "vitest";
import { runJobs } from "@/server/jobs/registry";

describe("runJobs", () => {
  it("runs the jobs of the requested cadence and reports results", async () => {
    const tick = await runJobs("tick");
    expect(tick.length).toBeGreaterThan(0);
    expect(tick.every((r) => r.ok)).toBe(true);
    expect(await runJobs("daily")).toEqual([]);
  });

  it("is safe to run twice (idempotency contract)", async () => {
    const a = await runJobs("tick");
    const b = await runJobs("tick");
    expect(b.map((r) => r.name)).toEqual(a.map((r) => r.name));
  });
});
