import { describe, expect, it } from "vitest";
import { allBrandNames } from "../src/config/brand";
import { findBrandViolations, isAllowedPath } from "./lib/brand-check";

const name = allBrandNames()[0] as string;
const files = (path: string, content: string) => [{ path, content }];

describe("findBrandViolations", () => {
  it("flags a hardcoded name with its line number", () => {
    const v = findBrandViolations(
      files("src/x.tsx", `a\n<h1>${name} store</h1>`),
      [name],
      isAllowedPath,
    );
    expect(v).toEqual([{ path: "src/x.tsx", line: 2, text: `<h1>${name} store</h1>` }]);
  });
  it("is case-insensitive and catches slugs and split-case spellings", () => {
    expect(
      findBrandViolations(files("src/y.ts", name.toLowerCase()), [name], isAllowedPath),
    ).toHaveLength(1);
    expect(
      findBrandViolations(files("src/y.ts", name.toUpperCase()), [name], isAllowedPath),
    ).toHaveLength(1);
  });
  it("exempts the brand config, messages and docs only", () => {
    const content = `x ${name}`;
    for (const path of ["src/config/brand.ts", "messages/en.json", "docs/BRAND.md"]) {
      expect(findBrandViolations(files(path, content), [name], isAllowedPath)).toEqual([]);
    }
    expect(
      findBrandViolations(files("src/app/page.tsx", content), [name], isAllowedPath),
    ).toHaveLength(1);
    expect(
      findBrandViolations(files("src/config/brand.test.ts", content), [name], isAllowedPath),
    ).toHaveLength(1);
  });
  it("passes clean files and refuses an empty name list", () => {
    expect(findBrandViolations(files("src/ok.ts", "const a = 1;"), [name], isAllowedPath)).toEqual(
      [],
    );
    expect(() => findBrandViolations([], [], isAllowedPath)).toThrow();
  });
  it("escapes regex characters in names", () => {
    expect(findBrandViolations(files("src/z.ts", "a.b"), ["a.b"], isAllowedPath)).toHaveLength(1);
    expect(findBrandViolations(files("src/z.ts", "axb"), ["a.b"], isAllowedPath)).toEqual([]);
  });
});
