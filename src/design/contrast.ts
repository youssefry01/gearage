/** WCAG 2.x contrast math. Pure, no dependencies. https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio */

export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Expected a 6-digit hex color like #0D1114, got "${hex}"`);
  const n = Number.parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA thresholds: normal text 4.5, large text and UI components/graphics 3. */
export const AA = { text: 4.5, large: 3, ui: 3 } as const;
export type AaKind = keyof typeof AA;
