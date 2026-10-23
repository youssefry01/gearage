import { describe, expect, it } from "vitest";
import { isDemoCatalog } from "./demo-catalog";

describe("isDemoCatalog", () => {
  it("is on by default and for any value except the literal 'false'", () => {
    expect(isDemoCatalog({})).toBe(true);
    for (const v of ["true", "", "0", "False", "no", "off"])
      expect(isDemoCatalog({ CATALOG_DEMO_NOTICE: v })).toBe(true);
  });
  it("is off only with CATALOG_DEMO_NOTICE=false", () => {
    expect(isDemoCatalog({ CATALOG_DEMO_NOTICE: "false" })).toBe(false);
  });
});
