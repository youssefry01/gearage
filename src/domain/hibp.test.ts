import { describe, expect, it } from "vitest";
import { breachCount, splitSha1 } from "./hibp";

// SHA-1 of "password"
const SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";

describe("hibp helpers", () => {
  it("splits the digest into a 5-character prefix and the rest", () => {
    expect(splitSha1(SHA1)).toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });
  it("refuses anything that is not an upper-case SHA-1", () => {
    expect(() => splitSha1("abc")).toThrow();
    expect(() => splitSha1(SHA1.toLowerCase())).toThrow();
  });
  it("finds the count for the suffix and 0 when absent", () => {
    const body =
      "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:10434004\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:1";
    expect(breachCount(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(10434004);
    expect(breachCount(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
  });
  it("ignores padding lines (count 0)", () => {
    expect(
      breachCount("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0", "1E4C9B93F3F0682250B6CF8331B7EE68FD8"),
    ).toBe(0);
  });
});
