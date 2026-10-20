import { brandColors } from "@/design/tokens";
import { GLYPHS, type GlyphKind } from "./glyphs";

/** Neutral surfaces mirror the dark theme tokens (src/design/tokens.ts); the two brand colors come from there. */
const INK = brandColors.ink;
const ORANGE = brandColors.orange;
const PANEL = "#151A1F";
const GRID = "#1F262D";
const TEXT = "#F2F4F5";
const MUTED = "#A3ADB5";
const FONT = "'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif";

const escapeXml = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Greedy word wrap into at most `maxLines` lines of about `maxChars`; the last line is cut with an ellipsis. */
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && `${line} ${w}`.length > maxChars) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] as string;
  kept[maxLines - 1] = `${last.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}\u2026`;
  return kept;
}

const frame = (w: number, h: number, label: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(label)}">` +
  `<defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${GRID}" stroke-width="1"/></pattern></defs>` +
  `<rect width="${w}" height="${h}" fill="${INK}"/><rect width="${w}" height="${h}" fill="url(#g)"/>${body}</svg>\n`;

const glyph = (kind: GlyphKind, x: number, y: number, scale: number): string =>
  `<g transform="translate(${x} ${y}) scale(${scale})" stroke-width="${(8 / scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">` +
  `${GLYPHS[kind]({ a: ORANGE, f: MUTED })}</g>`;

const pill = (x: number, y: number, text: string): string =>
  `<g><rect x="${x}" y="${y}" width="${text.length * 9.2 + 24}" height="30" rx="15" fill="${PANEL}" stroke="${MUTED}" stroke-width="1"/>` +
  `<text x="${x + 12}" y="${y + 20}" font-family="${FONT}" font-size="13" letter-spacing="1" fill="${MUTED}">${escapeXml(text)}</text></g>`;

const lines = (
  parts: string[],
  x: number,
  y: number,
  size: number,
  fill: string,
  weight: number,
): string =>
  parts
    .map(
      (p, i) =>
        `<text x="${x}" y="${y + i * (size + 8)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(p)}</text>`,
    )
    .join("");

const NOTE = "ILLUSTRATIVE PLACEHOLDER";

/** Product image 1: glyph centred, brand and model underneath. 800 x 800. */
export function productMain(input: { brand: string; model: string; kind: GlyphKind }): string {
  const model = wrap(input.model, 26, 2);
  return frame(
    800,
    800,
    `${input.brand} ${input.model} (illustrative placeholder)`,
    pill(32, 32, NOTE) +
      `<rect x="120" y="120" width="560" height="440" rx="28" fill="${PANEL}"/>` +
      glyph(input.kind, 200, 140, 1.0) +
      `<rect x="32" y="600" width="6" height="${model.length * 50 + 30}" rx="3" fill="${ORANGE}"/>` +
      `<text x="56" y="624" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${ORANGE}">${escapeXml(input.brand.toUpperCase())}</text>` +
      lines(model, 56, 676, 42, TEXT, 600),
  );
}

/** Product image 2: smaller glyph beside up to three spec chips. 800 x 800. */
export function productDetail(input: {
  brand: string;
  model: string;
  kind: GlyphKind;
  chips: string[];
}): string {
  const chips = input.chips.slice(0, 3);
  return frame(
    800,
    800,
    `${input.brand} ${input.model} key specs (illustrative placeholder)`,
    pill(32, 32, NOTE) +
      glyph(input.kind, 200, 80, 1.0) +
      chips
        .map(
          (chip, i) =>
            `<rect x="130" y="${520 + i * 80}" width="540" height="60" rx="14" fill="${PANEL}" stroke="${GRID}"/>` +
            `<rect x="130" y="${520 + i * 80}" width="8" height="60" rx="4" fill="${ORANGE}"/>` +
            `<text x="160" y="${559 + i * 80}" font-family="${FONT}" font-size="24" font-weight="600" fill="${TEXT}">${escapeXml(chip)}</text>`,
        )
        .join("") +
      `<text x="32" y="780" font-family="${FONT}" font-size="14" fill="${MUTED}">${escapeXml(input.brand)} ${escapeXml(wrap(input.model, 40, 1)[0] ?? "")}</text>`,
  );
}

/** Showcase block image. 1200 x 675. */
export function showcaseImage(input: { kind: GlyphKind; title: string; index: number }): string {
  const flip = input.index % 2 === 0;
  return frame(
    1200,
    675,
    `${input.title} (illustrative placeholder)`,
    pill(40, 36, NOTE) +
      glyph(input.kind, flip ? 680 : 120, 150, 1.1) +
      `<rect x="${flip ? 64 : 700}" y="250" width="6" height="110" rx="3" fill="${ORANGE}"/>` +
      lines(wrap(input.title, 22, 2), flip ? 90 : 726, 290, 44, TEXT, 600) +
      `<text x="${flip ? 90 : 726}" y="${flip ? 400 : 400}" font-family="${FONT}" font-size="20" fill="${MUTED}">Sample showcase artwork</text>`,
  );
}

/** Category tile. 800 x 600. */
export function categoryTile(input: { name: string; kind: GlyphKind }): string {
  return frame(
    800,
    600,
    `${input.name} (illustrative placeholder)`,
    `<rect x="60" y="50" width="680" height="380" rx="28" fill="${PANEL}"/>` +
      glyph(input.kind, 200, 55, 1.0) +
      `<rect x="60" y="470" width="6" height="64" rx="3" fill="${ORANGE}"/>` +
      lines(wrap(input.name, 30, 1), 86, 516, 44, TEXT, 600),
  );
}

/** Brand wordmark tile (text only: never a reproduction of a real logo). 480 x 200. */
export function brandTile(name: string): string {
  return frame(
    480,
    200,
    `${name} (placeholder wordmark)`,
    `<text x="240" y="112" text-anchor="middle" font-family="${FONT}" font-size="${name.length > 12 ? 38 : 52}" font-weight="700" fill="${TEXT}">${escapeXml(name)}</text>` +
      `<rect x="200" y="136" width="80" height="6" rx="3" fill="${ORANGE}"/>`,
  );
}
