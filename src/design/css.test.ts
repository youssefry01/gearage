import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTokensCss } from "./css";

describe("tokens.css", () => {
  it("is in sync with src/design/tokens.ts (run `npm run tokens:build`)", () => {
    expect(readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8")).toBe(
      renderTokensCss(),
    );
  });
  it("makes dark the default, with explicit light and system selectors", () => {
    const css = renderTokensCss();
    expect(css).toMatch(/:root,\s*\[data-theme="dark"\]/);
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain('[data-theme="system"]');
    expect(css).toContain("--color-primary: var(--primary);");
  });
});
