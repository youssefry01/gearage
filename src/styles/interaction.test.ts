import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Interaction states cannot be forgotten (M5a-3). Two rules, enforced on the source of every component:
 *
 *  1. Every native control a shopper presses (`<button>`, `<summary>`, anything with `role="button"`) must show a hover
 *     state: its class names (resolved through same-file constants) contain a `hover:` utility. Controls that render
 *     through our `<Button>` get it from `button.tsx`, which this test also checks.
 *  2. Nothing may remove the focus outline without drawing a replacement (`outline-none` needs a `focus-visible:`
 *     ring or outline in the same class string). The global `:focus-visible` rule covers everything else.
 *
 * Disabled-cursor safety: no class string may combine `disabled:pointer-events-none` with a native control, because
 * `pointer-events: none` hides the not-allowed cursor.
 */

const SRC = join(process.cwd(), "src");

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) yield full;
  }
}

function stringsIn(node: ts.Node, constants: Map<string, string>): string {
  let out = "";
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n)) out += ` ${n.text}`;
    else if (ts.isTemplateExpression(n)) {
      out += ` ${n.head.text}`;
      for (const span of n.templateSpans) out += ` ${span.literal.text}`;
    } else if (ts.isIdentifier(n) && constants.has(n.text)) out += ` ${constants.get(n.text)}`;
    // buttonStyles() returns the variant classes; the Button test below proves every variant has a hover state.
    else if (ts.isCallExpression(n) && n.expression.getText() === "buttonStyles") out += " hover:";
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

type Finding = { file: string; line: number; tag: string; problem: string };

function audit(file: string): Finding[] {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = new Map<string, string>();
  source.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return;
    for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) {
        const value = stringsIn(d.initializer, constants);
        if (value.trim()) constants.set(d.name.text, value);
      }
    }
  });
  const findings: Finding[] = [];
  const rel = relative(process.cwd(), file).split(sep).join("/");
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(source);
      const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
      const attr = (name: string) => attrs.find((a) => a.name.getText(source) === name);
      const className = attr("className");
      const classes = className?.initializer ? stringsIn(className.initializer, constants) : "";
      const role = attr("role")?.initializer?.getText(source) ?? "";
      const pressable = tag === "button" || tag === "summary" || /["']button["']/.test(role);
      const line = source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
      if (pressable) {
        const spread = attrs.length !== n.attributes.properties.length;
        if (!/(^|\s|:)hover:/.test(classes) && !spread) {
          findings.push({ file: rel, line, tag, problem: "no hover: state" });
        }
        if (/disabled:pointer-events-none/.test(classes)) {
          findings.push({
            file: rel,
            line,
            tag,
            problem: "disabled:pointer-events-none hides the cursor",
          });
        }
      }
      // Containers that only receive focus from code (a dialog panel, a heading moved to after navigation) are not
      // operable controls, so removing their outline is fine; any interactive element must keep a visible focus.
      const interactive = pressable || ["a", "input", "select", "textarea", "Link"].includes(tag);
      if (
        interactive &&
        /(^|\s)(?:focus:)?outline-(?:none|0)(\s|$)/.test(classes) &&
        !/focus-visible:/.test(classes)
      ) {
        findings.push({
          file: rel,
          line,
          tag,
          problem: "removes the outline without a focus-visible replacement",
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return findings;
}

describe("interaction states", () => {
  const all = [...walk(SRC)].flatMap(audit);

  it("every native pressable control has a hover state and no control hides its focus ring", () => {
    expect(all.map((f) => `${f.file}:${f.line} <${f.tag}> ${f.problem}`)).toEqual([]);
  });

  it("our Button gives every variant a hover state and keeps the not-allowed cursor reachable", () => {
    const text = readFileSync(join(SRC, "components/ui/button.tsx"), "utf8");
    for (const variant of ["primary", "secondary", "ghost", "link"]) {
      const line = text.split("\n").find((l) => new RegExp(`^\\s*${variant}:`).test(l));
      expect(line, `variant ${variant}`).toMatch(/hover:/);
    }
    expect(text).not.toMatch(/disabled:pointer-events-none/);
  });

  it("the global stylesheet sets pointer for enabled controls and not-allowed for disabled ones", () => {
    const css = readFileSync(join(SRC, "styles/globals.css"), "utf8");
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor:\s*pointer/);
    expect(css).toMatch(/summary[\s\S]*?cursor:\s*pointer/);
    expect(css).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
    expect(css).toMatch(/label:has\(input:is\(\[type="checkbox"\], \[type="radio"\]/);
    expect(css).toMatch(/button:disabled[\s\S]*?cursor:\s*not-allowed/);
  });
});
