# Images and brand assets

## What the demo uses

All product, category, brand and showcase images in the seed are **generated SVG placeholders** (`prisma/seed/placeholders/`).
They are simple line illustrations in the store's colors, labelled "ILLUSTRATIVE PLACEHOLDER", and show no real product, photo,
trade dress or manufacturer logo. Brand tiles are plain text wordmarks. This keeps the demo free of third-party copyright and
trademark material.

## Real product images

Real images must come from **official brand or distributor media kits, used with permission**. Do not scrape retailer or
manufacturer sites and do not hotlink. For each image keep the permission with it:

- The showcase block has **credit/source** and **license/permission note** fields; fill both when you add official content.
- Prefer assets the manufacturer explicitly offers for resellers (press kits, partner portals). Read the terms: many allow
  resale listings but not editing, cropping logos off, or reuse in advertising.
- Keep the original file or its licence email so you can prove permission.

## How images are stored

Images are uploaded to **our own storage** through the storage provider interface (`src/server/storage`): local disk in
development, Supabase Storage or Cloudinary (free tiers) in production. Product pages render them with `next/image` (optimized,
lazy-loaded, with `sizes`) and localized alt text. Uploads are validated (type sniffing, size and pixel limits) and re-encoded;
SVG uploads are refused for admins. The seed is the **only** writer of SVG, through an explicit `allowSvg` option, because
SVGs can carry scripts. Plain SVGs shown through `<img>` cannot run them, but they also bypass `next/image` optimization; real
photos will be raster and optimized.

## Swapping placeholders for real images

1. Upload through the admin (M10b) or write the file with the storage provider.
2. Replace the product's image rows (`ProductImage.storageKey`) and alt texts. The placeholders live under the `seed/` key prefix,
   so they are easy to find and delete.
3. Re-running `npm run db:seed` restores placeholders for seeded products (it owns their image rows); remove a product from the
   seed data or stop seeding once you manage the catalog yourself.

## Brand assets

The logo files in `public/brand/` and their derivatives are documented in [BRAND.md](BRAND.md).
