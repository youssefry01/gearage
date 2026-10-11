/**
 * Derives web-ready brand files from the ORIGINAL artwork in design/brand-source/. Nothing is redrawn:
 *  - logo variants are cropped to their opaque bounds (transparent margins removed, pixels untouched)
 *  - favicon / app icon / OG image are compositions of the icon-only logo on the brand dark surface
 * Re-run with `npm run brand:assets` after replacing files in design/brand-source/. See docs/BRAND.md.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { colorTokens } from "../src/design/tokens";

const root = process.cwd();
const src = (p: string) => resolve(root, "design/brand-source", p);
const out = (p: string) => resolve(root, p);
const SURFACE = colorTokens.dark.background;

async function cropToOpaque(file: string): Promise<{ png: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width,
    minY = info.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`${file} is fully transparent`);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const png = await sharp(file)
    .extract({ left: minX, top: minY, width, height })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, width, height };
}

/** Icon on a square brand-surface tile. `radius` is a fraction of the size (0 = square, full bleed). */
async function tile(icon: Buffer, size: number, fill: number, radius: number): Promise<Buffer> {
  const inner = await sharp(icon)
    .resize({
      width: Math.round(size * fill),
      height: Math.round(size * fill),
      fit: "inside",
      kernel: "lanczos3",
    })
    .toBuffer();
  const base = sharp({
    create: { width: size, height: size, channels: 4, background: SURFACE },
  }).composite([{ input: inner, gravity: "center" }]);
  if (radius === 0) return base.png({ compressionLevel: 9 }).toBuffer();
  const r = Math.round(size * radius);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
  );
  return sharp(await base.png().toBuffer())
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** PNG-in-ICO container (supported by every current browser). */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  mkdirSync(out("public/brand"), { recursive: true });

  // Vector icon: copied exactly as provided.
  copyFileSync(src("Icon/Vector/logo.svg"), out("public/brand/logo-icon-on-dark.svg"));
  copyFileSync(src("Icon/Vector/logo-dark.svg"), out("public/brand/logo-icon-on-light.svg"));

  // Raster variants: highest-resolution source of each, cropped to opaque bounds.
  // Source naming: no suffix = light artwork (for dark backgrounds); "-dark" = dark artwork (for light backgrounds).
  const variants: [string, string][] = [
    ["Inline/logo-inline.png", "public/brand/logo-inline-on-dark.png"],
    ["Inline/logo-inline-dark.png", "public/brand/logo-inline-on-light.png"],
    ["Stacked/logo-stacked2400.png", "public/brand/logo-stacked-on-dark.png"],
    ["Stacked/logo-stacked-dark2400.png", "public/brand/logo-stacked-on-light.png"],
    ["Icon/Screen_Use/logo2400.png", "public/brand/logo-icon-on-dark.png"],
    ["Icon/Screen_Use/logo2400-dark.png", "public/brand/logo-icon-on-light.png"],
  ];
  let iconOnDark: Buffer | undefined;
  for (const [from, to] of variants) {
    const { png, width, height } = await cropToOpaque(src(from));
    writeFileSync(out(to), png);
    if (to.endsWith("logo-icon-on-dark.png")) iconOnDark = png;
    console.log(`${to.padEnd(46)} ${width}x${height}`);
  }
  if (!iconOnDark) throw new Error("icon variant missing");

  // Favicon family, derived from the icon-only logo (light artwork on the dark brand surface).
  writeFileSync(
    out("src/app/favicon.ico"),
    buildIco(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({ size, png: await tile(iconOnDark, size, 0.82, 0.2) })),
      ),
    ),
  );
  writeFileSync(out("src/app/icon.png"), await tile(iconOnDark, 192, 0.74, 0.2));
  writeFileSync(out("src/app/apple-icon.png"), await tile(iconOnDark, 180, 0.7, 0)); // iOS applies its own mask

  // Open Graph / Twitter image: icon-only on the brand surface, 1200x630.
  const ogIcon = await sharp(iconOnDark).resize({ height: 360, kernel: "lanczos3" }).toBuffer();
  writeFileSync(
    out("public/brand/og-default.png"),
    await sharp({ create: { width: 1200, height: 630, channels: 4, background: SURFACE } })
      .composite([{ input: ogIcon, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );
  console.log(
    "favicon.ico, icon.png, apple-icon.png written to src/app/; og-default.png written to public/brand/",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
