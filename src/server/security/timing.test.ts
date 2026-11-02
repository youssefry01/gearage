// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withMinimumDuration } from "./timing";

function fakeClock() {
  let t = 0;
  const slept: number[] = [];
  return {
    clock: {
      now: () => t,
      sleep: async (ms: number) => {
        slept.push(ms);
        t += ms;
      },
    },
    advance: (ms: number) => (t += ms),
    slept,
  };
}

describe("withMinimumDuration", () => {
  it("pads a fast call up to the floor", async () => {
    const { clock, advance, slept } = fakeClock();
    await withMinimumDuration(400, async () => advance(50), clock);
    expect(slept).toEqual([350]);
  });
  it("does not add time to a call that already took longer", async () => {
    const { clock, advance, slept } = fakeClock();
    await withMinimumDuration(400, async () => advance(500), clock);
    expect(slept).toEqual([]);
  });
  it("pads a call that throws too, then rethrows (a missing account must not answer faster)", async () => {
    const { clock, advance, slept } = fakeClock();
    await expect(
      withMinimumDuration(
        400,
        async () => {
          advance(10);
          throw new Error("boom");
        },
        clock,
      ),
    ).rejects.toThrow("boom");
    expect(slept).toEqual([390]);
  });
  it("returns the value", async () => {
    const { clock } = fakeClock();
    expect(await withMinimumDuration(1, async () => 42, clock)).toBe(42);
  });
});
