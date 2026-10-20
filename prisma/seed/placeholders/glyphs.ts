/**
 * Simple line-art glyphs, one per kind of hardware, drawn in a 400x400 box. They are deliberately generic (no real
 * product, logo or trade dress): the seed ships illustrations, never manufacturer photos (docs/ASSETS.md).
 * `a` is the accent stroke (brand orange), `f` the neutral stroke.
 */
export type GlyphKind =
  | "cpu"
  | "gpu"
  | "board"
  | "ram"
  | "ssd"
  | "hdd"
  | "psu"
  | "tower"
  | "aircooler"
  | "aio"
  | "fan"
  | "laptop"
  | "monitor"
  | "keyboard"
  | "mouse"
  | "headset"
  | "webcam"
  | "router"
  | "card"
  | "switch"
  | "mic"
  | "paste"
  | "pad"
  | "bundle"
  | "gift";

type Strokes = { a: string; f: string };
const r = (x: number, y: number, w: number, h: number, rx: number, c: string, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${c}" ${extra}/>`;
const c = (x: number, y: number, rad: number, col: string, extra = "") =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="none" stroke="${col}" ${extra}/>`;
const l = (x1: number, y1: number, x2: number, y2: number, col: string) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}"/>`;
const pins = (
  from: number,
  to: number,
  step: number,
  fixed: number,
  horizontal: boolean,
  len: number,
  col: string,
) => {
  const out: string[] = [];
  for (let v = from; v <= to; v += step)
    out.push(horizontal ? l(fixed, v, fixed + len, v, col) : l(v, fixed, v, fixed + len, col));
  return out.join("");
};

export const GLYPHS: Record<GlyphKind, (s: Strokes) => string> = {
  cpu: ({ a, f }) =>
    r(110, 110, 180, 180, 16, a) +
    r(150, 150, 100, 100, 8, f) +
    pins(135, 265, 26, 80, false, 30, f) +
    pins(135, 265, 26, 290, false, 30, f) +
    pins(135, 265, 26, 80, true, 30, f) +
    pins(135, 265, 26, 290, true, 30, f) +
    l(110, 130, 130, 110, a),
  gpu: ({ a, f }) =>
    r(40, 130, 320, 120, 14, a) +
    c(130, 190, 44, f) +
    c(130, 190, 12, f) +
    c(250, 190, 44, f) +
    c(250, 190, 12, f) +
    r(60, 250, 150, 22, 4, f) +
    l(300, 130, 300, 100, f) +
    l(330, 130, 330, 100, f),
  board: ({ a, f }) =>
    r(80, 70, 240, 260, 12, a) +
    r(130, 110, 70, 70, 6, f) +
    r(230, 100, 14, 110, 3, f) +
    r(256, 100, 14, 110, 3, f) +
    r(130, 230, 150, 18, 3, f) +
    r(130, 262, 150, 18, 3, f) +
    c(110, 100, 6, f),
  ram: ({ a, f }) =>
    r(50, 140, 300, 90, 8, a) +
    r(70, 160, 40, 50, 4, f) +
    r(125, 160, 40, 50, 4, f) +
    r(180, 160, 40, 50, 4, f) +
    r(235, 160, 40, 50, 4, f) +
    pins(60, 340, 14, 230, false, 22, f),
  ssd: ({ a, f }) =>
    r(60, 160, 280, 80, 10, a) +
    r(90, 180, 60, 40, 4, f) +
    r(165, 180, 60, 40, 4, f) +
    l(300, 160, 300, 240, f) +
    c(318, 200, 8, f),
  hdd: ({ a, f }) =>
    r(110, 70, 180, 260, 14, a) +
    c(200, 170, 62, f) +
    c(200, 170, 10, f) +
    l(200, 170, 250, 112, f) +
    r(150, 270, 100, 24, 4, f),
  psu: ({ a, f }) =>
    r(70, 110, 260, 180, 12, a) +
    c(170, 200, 58, f) +
    c(170, 200, 12, f) +
    r(250, 150, 50, 20, 3, f) +
    r(250, 180, 50, 20, 3, f) +
    r(250, 210, 50, 20, 3, f) +
    l(270, 290, 270, 320, f),
  tower: ({ a, f }) =>
    r(115, 50, 170, 300, 14, a) +
    r(135, 80, 130, 150, 8, f) +
    c(200, 150, 34, f) +
    r(135, 255, 130, 18, 4, f) +
    c(200, 312, 8, f),
  aircooler: ({ a, f }) =>
    r(110, 60, 180, 240, 10, a) + pins(88, 276, 22, 124, true, 152, f) + c(200, 338, 26, f),
  aio: ({ a, f }) =>
    r(70, 70, 140, 140, 12, a) +
    c(140, 140, 42, f) +
    c(300, 290, 44, a) +
    c(300, 290, 12, f) +
    `<path d="M210 140 C 260 140 300 180 300 246" fill="none" stroke="${f}"/>`,
  fan: ({ a, f }) =>
    r(80, 80, 240, 240, 22, a) +
    c(200, 200, 96, f) +
    c(200, 200, 18, a) +
    `<path d="M200 182 C 190 130 240 120 252 150 M218 200 C 270 190 280 240 250 252 M200 218 C 210 270 160 280 148 250 M182 200 C 130 210 120 160 150 148" fill="none" stroke="${a}"/>`,
  laptop: ({ a, f }) =>
    r(90, 100, 220, 150, 10, a) +
    r(108, 116, 184, 118, 4, f) +
    `<path d="M50 262 H350 L330 290 H70 Z" fill="none" stroke="${a}"/>` +
    l(180, 276, 220, 276, f),
  monitor: ({ a, f }) =>
    r(60, 90, 280, 170, 12, a) +
    r(78, 108, 244, 134, 4, f) +
    l(200, 260, 200, 304, f) +
    l(150, 304, 250, 304, a),
  keyboard: ({ a, f }) =>
    r(40, 130, 320, 140, 14, a) +
    Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 9 }, (_, i) => r(62 + i * 32, 152 + row * 34, 24, 24, 4, f)).join(""),
    ).join("") +
    r(110, 252, 180, 10, 3, f),
  mouse: ({ a, f }) =>
    `<path d="M200 70 C 120 70 110 150 110 200 C 110 290 150 330 200 330 C 250 330 290 290 290 200 C 290 150 280 70 200 70 Z" fill="none" stroke="${a}"/>` +
    l(200, 70, 200, 170, f) +
    l(112, 170, 288, 170, f) +
    r(190, 100, 20, 36, 8, f),
  headset: ({ a, f }) =>
    `<path d="M90 230 V190 C 90 110 140 70 200 70 C 260 70 310 110 310 190 V230" fill="none" stroke="${a}"/>` +
    r(70, 200, 46, 90, 14, f) +
    r(284, 200, 46, 90, 14, f) +
    `<path d="M100 290 C 100 330 150 330 180 322" fill="none" stroke="${f}"/>`,
  webcam: ({ a, f }) =>
    c(200, 150, 80, a) +
    c(200, 150, 44, f) +
    c(200, 150, 12, f) +
    r(160, 240, 80, 26, 6, f) +
    l(200, 266, 200, 300, f) +
    l(150, 300, 250, 300, a),
  router: ({ a, f }) =>
    r(70, 200, 260, 70, 12, a) +
    c(110, 235, 7, f) +
    c(140, 235, 7, f) +
    c(170, 235, 7, f) +
    l(110, 200, 90, 80, f) +
    l(290, 200, 310, 80, f) +
    `<path d="M170 150 C 190 120 210 120 230 150 M150 125 C 185 80 215 80 250 125" fill="none" stroke="${a}"/>`,
  card: ({ a, f }) =>
    r(70, 120, 260, 120, 10, a) +
    r(90, 240, 120, 26, 4, f) +
    c(240, 180, 30, f) +
    l(300, 120, 300, 90, f) +
    `<path d="M140 90 C 160 70 180 70 200 90" fill="none" stroke="${a}"/>`,
  switch: ({ a, f }) =>
    r(50, 160, 300, 80, 10, a) +
    Array.from({ length: 8 }, (_, i) => r(68 + i * 34, 190, 22, 24, 3, f)).join(""),
  mic: ({ a, f }) =>
    r(160, 50, 80, 160, 40, a) +
    pins(90, 190, 20, 160, true, 80, f) +
    `<path d="M120 170 C 120 240 160 262 200 262 C 240 262 280 240 280 170" fill="none" stroke="${f}"/>` +
    l(200, 262, 200, 320, f) +
    l(150, 320, 250, 320, a),
  paste: ({ a, f }) =>
    r(70, 170, 190, 60, 10, a) +
    `<path d="M260 185 L320 200 L260 215" fill="none" stroke="${a}"/>` +
    l(110, 170, 110, 230, f) +
    c(340, 200, 6, f),
  pad: ({ a, f }) =>
    r(50, 100, 300, 200, 22, a) + r(215, 160, 52, 80, 24, f) + l(241, 160, 241, 190, f),
  bundle: ({ a, f }) =>
    r(135, 60, 130, 230, 12, a) +
    c(200, 130, 26, f) +
    r(150, 190, 100, 14, 3, f) +
    r(150, 214, 100, 14, 3, f) +
    r(40, 250, 70, 50, 6, f) +
    r(290, 250, 70, 50, 6, f) +
    c(75, 275, 10, a) +
    c(325, 275, 10, a),
  gift: ({ a, f }) =>
    r(90, 160, 220, 150, 8, a) +
    r(70, 120, 260, 44, 8, f) +
    l(200, 120, 200, 310, f) +
    `<path d="M200 120 C 160 70 110 80 130 118 M200 120 C 240 70 290 80 270 118" fill="none" stroke="${a}"/>`,
};
