import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/locales";

/**
 * Every message key the compatibility rules can emit must exist in every locale, with exactly the placeholders the
 * rule supplies. Read from the rules' source so a new rule or a renamed parameter fails here, not on a shopper's page.
 */
const source = readFileSync(resolve(process.cwd(), "src/domain/compatibility.ts"), "utf8");
const emitted = new Map<string, string[]>();
/** Parameter names of an object literal body: strips strings and call arguments, then reads `name:` or shorthand `name`. */
const paramNames = (body: string): string[] =>
  body
    .replace(/"[^"]*"/g, '""')
    .replace(/\([^)]*\)/g, "()")
    .split(",")
    .map((part) => (part.split(":")[0] ?? "").trim())
    .filter(Boolean)
    .sort();
for (const m of source.matchAll(
  /issue\(\s*"(?:fail|warn|unknown)",\s*"([A-Za-z0-9]+)",\s*\{([^}]*)\}/g,
)) {
  emitted.set(m[1] ?? "", paramNames(m[2] ?? ""));
}

const names = (message: string): string[] => {
  const out = new Set<string>();
  const visit = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
      if (el.type === TYPE.tag) visit(el.children);
      else {
        out.add(el.value);
        if (el.type === TYPE.plural || el.type === TYPE.select)
          for (const o of Object.values(el.options)) visit(o.value);
      }
    }
  };
  visit(parse(message));
  return [...out].sort();
};

describe("compatibility messages", () => {
  it("finds the rule messages in the source (guards the regex itself)", () => {
    expect(emitted.size).toBeGreaterThanOrEqual(15);
    expect(emitted.get("psuInsufficient")).toEqual(["estimatedW", "psuW"]);
  });

  it.each(locales)("%s has every emitted key with matching placeholders", (locale) => {
    const messages = JSON.parse(
      readFileSync(resolve(process.cwd(), `messages/${locale}.json`), "utf8"),
    ) as {
      Compatibility: Record<string, string>;
    };
    for (const [key, params] of emitted) {
      const text = messages.Compatibility[key];
      expect(text, `${locale}: Compatibility.${key} missing`).toBeTruthy();
      expect(names(text ?? ""), `${locale}: Compatibility.${key}`).toEqual(params);
    }
  });
});
