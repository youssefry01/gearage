import { evaluatePairs } from "../src/design/evaluate";

const results = evaluatePairs();
const pad = (s: string, n: number) => s.padEnd(n);

for (const r of results) {
  const mark = r.pass ? "ok  " : "FAIL";
  console.log(
    `${mark} ${pad(r.theme, 5)} ${pad(`${r.fg} on ${r.bg}`, 44)} ${r.ratio.toFixed(2).padStart(5)}:1 (min ${r.min})  ${r.use}`,
  );
}

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} pairs meet WCAG AA`);
if (failures.length > 0) {
  console.error(
    `${failures.length} pair(s) below WCAG AA. Fix the token values in src/design/tokens.ts.`,
  );
  process.exit(1);
}
