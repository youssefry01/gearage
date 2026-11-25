import { describe, expect, it } from "vitest";
import { stuckHeaderHeight } from "./sticky-offset";

describe("stuckHeaderHeight", () => {
  it("is the whole header when it sticks at the very top", () => {
    expect(stuckHeaderHeight({ position: "sticky", height: 120, top: 0 })).toBe(120);
  });
  it("drops the part that scrolls away (a negative top)", () => {
    expect(stuckHeaderHeight({ position: "sticky", height: 152.4, top: -36 })).toBe(116);
  });
  it("is 0 when the header is not sticky", () => {
    expect(stuckHeaderHeight({ position: "static", height: 152, top: 0 })).toBe(0);
  });
  it("ignores a top it cannot read or that is positive, and never goes negative", () => {
    expect(stuckHeaderHeight({ position: "sticky", height: 100, top: Number.NaN })).toBe(100);
    expect(stuckHeaderHeight({ position: "sticky", height: 100, top: 10 })).toBe(100);
    expect(stuckHeaderHeight({ position: "sticky", height: 20, top: -50 })).toBe(0);
  });
});
