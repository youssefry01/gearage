# Seeding

`npm run db:seed` fills your **local** development database with realistic **catalog data only**: categories, spec definitions,
brands, tags, products with stock, bundles, showcase blocks and generated placeholder images. It never creates users, orders,
reviews, carts or settings.

```bash
npm run db:migrate     # apply the migrations first
npm run db:seed        # safe to run as often as you like
```

## Rules the seed follows

- **Local only.** It refuses to run unless `DATABASE_URL` / `DIRECT_URL` point at a local host (`prisma/guard.ts`, checked in
  `prisma/seed/index.ts` and again inside `runSeed`). There is no override. Production is never seeded.
- **Idempotent.** Every row is matched on a natural key (category path, brand/tag slug, SKU) and written only when it differs
  from the data files, so a second run changes nothing: same ids, same `updatedAt`. A test runs the seed three times and
  compares every row of every table (`tests/db/seed.db.test.ts`).
- **Additive.** It adds and updates; it never deletes rows. Remove a product by archiving it in the admin (M10) or reset your
  dev database. (A seeded bundle's composition is the one exception: it is restored to match the data file.)
- **Stock and counters are created once.** Initial stock (with one `RECEIVED` adjustment) and the view/sold counters are set when
  a product is first created and never touched again, so re-seeding cannot undo sales or inventory adjustments you made.
  To start fresh: `npx prisma migrate reset` (local only), then seed.
- **One transaction.** The database part is atomic: it either fully applies or leaves the database as it was.
- **Validated first.** Before anything is written, `prisma/seed/validate.ts` checks the data: unique SKUs and slugs, category and
  brand references, every product's specs against its category's definitions, the specs the compatibility rules need,
  bundle prices below the parts total, Arabic text present, and the data-only files. A mistake stops the seed with a list.

## What is in `prisma/seed/`

| Path                                 | Contents                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `data/categories.ts`                 | The category tree (3 levels, 9 top-level; `gift-cards` is inactive and reserved for later). |
| `data/brands.ts`, `data/tags.ts`     | Brands and editorial tags.                                                                  |
| `data/catalog/*.ts`                  | One file per product family: its **spec definitions** and its **products** (en + ar).       |
| `data/bundles.ts`                    | Six fixed-price bundles and the `pc-bundles` spec definitions.                              |
| `data/shipping-zones.ts`             | 27 governorates in 6 zones, fees, delivery estimates (**data only**, see below).            |
| `data/promo-codes.ts`                | Sample promo codes: valid, expired, usage-limited, category-restricted (**data only**).     |
| `data/branches.ts`                   | Three fictional sample branches for the store locator (**data only**).                      |
| `placeholders/`                      | The SVG generator (glyphs, layouts).                                                        |
| `validate.ts`, `derive.ts`, `run.ts` | Validation, derived values (slugs, prices, storage keys), the sync itself.                  |

### Data-only files

Shipping zones and promo codes have no tables yet (M6a), branches neither (M12). The seed **validates** these files (all 27
governorates covered exactly once, promo dates consistent, branch coordinates inside Egypt) so they cannot rot, but does **not**
insert them. The milestone that adds each table also adds its seed step, reading the same file.

## Spec definitions and inheritance

Definitions belong to the category that owns a product family (`components/cpus`); products live in its sub-categories
(`components/cpus/amd-ryzen`) and use the **nearest ancestor** that has definitions (`resolveSpecDefinitions`). A sub-category
with its own definitions overrides its family (`components/cooling/case-fans`). Facet convention: `CHECKBOX` for discrete values,
`RANGE` for continuous numbers, `TOGGLE` for booleans. Numeric lists (case radiator sizes) are stored as `STRING_LIST` of integers
as strings ("360") until a `NUMBER_LIST` type is justified; the compatibility module accepts both.

## Prices are illustrative

Every price in the data files is an **illustrative sample in EGP**, not a live market price, and cost is a flat 88% of the price
unless a product sets `costEgp`. Shipping fees, delivery estimates, warranty periods and the free-shipping threshold are
illustrative too. Set real values in the admin dashboard (M10) before launch. Money is stored as integer piastres.

## Images

Nothing is hotlinked or scraped. Every image is a **generated SVG placeholder** written to local storage under `seed/`
(`public/uploads/seed/...`, git-ignored), each clearly marked "ILLUSTRATIVE PLACEHOLDER": two per product and bundle, one per
category and brand (a wordmark, never a real logo), and one per image-type showcase block. They go through the storage provider
interface, so real images can replace them later without touching the data model. See [ASSETS.md](ASSETS.md).

## Things to know

- **Arabic copy is machine-written** and listed in [I18N_REVIEW.md](I18N_REVIEW.md) for native review.
- **Barcodes (EAN/GTIN) are never seeded**, and MPNs only where the author is confident of them.
- **Weights and dimensions** are seeded only for a few products; shipping fees are zone-based for now.
- **Showcase blocks** exist on 7 items (images, text, feature and one video block) to test the layout. The video block embeds
  an open-licence film (Big Buck Bunny, CC BY 3.0) purely to test the layout; its id was written from memory, so check that it
  plays (M3b renders it behind a click-to-play button, from `www.youtube-nocookie.com`).
- **Bundles** carry only editorial specs (`use_case`, `target_resolution`); CPU, GPU, memory and storage summaries are derived
  from the components so they cannot drift. All six pass the compatibility rules with zero warnings (tested).
- **Intel TDP**: `tdp_w` is Intel's base power (125 W for K-series); real turbo draw reaches 253 W. The PSU rule uses the listed
  value, so seeded Intel builds leave generous PSU headroom.
- **Seeded stock** deliberately includes out-of-stock items (Radeon RX 7600, Arc B580, Core i9-14900K, one Noctua fan), low
  stock (RTX 5080 FE, 5070 Ti, Ryzen 9 9950X, Ryzen 7 7800X3D...) and a bundle limited by its scarcest part.

## Adding or changing seed data

1. Edit the family's file in `prisma/seed/data/catalog/` (new product: copy a neighbour; every spec your category's definitions
   require must be present).
2. Flag any spec you are unsure of with `verify: { keys: [...], note }`.
3. `npm run seed:docs` (regenerates the block below), `npm run i18n:review` (Arabic list), `npm test`, `npm run test:db`.
4. `npm run db:seed`.

## Specs to verify

The block below is generated from the data files (`npm run seed:docs`; CI fails if it is stale).

<!-- prettier-ignore-start -->
<!-- seed:generated:start -->
<!-- This block is GENERATED by `npm run seed:docs` from prisma/seed/data. Do not edit it by hand. -->

### What the seed contains

| Top-level category | Products | Bundles |
| --- | ---: | ---: |
| Components | 57 | 0 |
| PC Bundles | 0 | 6 |
| Laptops | 4 | 0 |
| Monitors | 5 | 0 |
| Peripherals | 6 | 0 |
| Networking | 3 | 0 |
| Audio & Streaming | 2 | 0 |
| Accessories | 2 | 0 |
| Gift Cards (inactive, reserved) | 0 | 0 |
| **Total** | **79** | **6** |

53 categories, 21 brands, 17 tags, 123 spec definitions across 22 categories.
Data-only files (validated, inserted when their tables ship): 27 governorates in 6 shipping zones, 5 sample promo codes, 3 sample branches.

### Specs to verify (56 of 79 products flagged)

Every spec was written from the author's knowledge, not copied from a datasheet. The products below carry specs the author is
**not sure about**: confirm them on the manufacturer's page before trusting the compatibility badge or a spec filter. This is
a list of KNOWN doubt, not a certificate: the 23 unflagged products (`CPU-AMD-R5-5600`, `CPU-AMD-R5-7600`, `CPU-AMD-R7-7800X3D`, `CPU-AMD-R7-9700X`, `CPU-AMD-R9-9950X`, `CPU-INT-I5-12400F`, `CPU-INT-I5-14400F`, `GPU-NVIDIA-RTX5080-FE`, `RAM-KINGSTON-FURY-D4-16G-3200`, `RAM-CORSAIR-LPX-D4-32G-3200`, `SSD-SAMSUNG-870EVO-1TB`, `PSU-CM-MWE-BRONZE-550-V2`, `PSU-CORSAIR-CX650`, `PSU-CM-MWE-GOLD-750-V2`, `FAN-NOCTUA-NF-A12X25-PWM`, `FAN-NOCTUA-NF-P12-REDUX-1700`, `MOUSE-LOGITECH-G502-HERO`, `MOUSE-LOGITECH-G305-LIGHTSPEED`, `CAM-LOGITECH-C920-HD-PRO`, `NET-TPLINK-TL-SG108`, `MIC-HYPERX-QUADCAST-S`, `MIC-LOGITECH-BLUE-YETI`, `ACC-NOCTUA-NT-H1-3G5`) are believed correct but are also unverified.

| SKU | Product | Verify these specs | Why |
| --- | --- | --- | --- |
| `CPU-INT-I7-14700K` | Intel Core i7-14700K | `tdp_w` | Listed TDP is Intel's 125 W processor base power; maximum turbo power is 253 W, so real draw is much higher. The PSU rule uses the listed value. |
| `CPU-INT-I9-14900K` | Intel Core i9-14900K | `tdp_w` | Listed TDP is Intel's 125 W processor base power; maximum turbo power is 253 W. |
| `GPU-ASUS-DUAL-RTX4060-O8G` | ASUS Dual GeForce RTX 4060 OC 8GB | `length_mm`, `slots` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-MSI-RTX5060-VENTUS2X-8G` | MSI GeForce RTX 5060 Ventus 2X OC 8G | `length_mm`, `slots`, `power_connector` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-GIGABYTE-RTX5060TI-WF-16G` | Gigabyte GeForce RTX 5060 Ti WINDFORCE OC 16G | `length_mm`, `slots`, `power_connector` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-ASUS-PRIME-RTX5070-O12G` | ASUS Prime GeForce RTX 5070 OC 12GB | `length_mm`, `slots`, `power_connector` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-MSI-RTX5070TI-GAMINGTRIO-16G` | MSI GeForce RTX 5070 Ti 16G Gaming Trio OC | `length_mm`, `slots` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-GIGABYTE-RX7600-GAMING-OC-8G` | Gigabyte Radeon RX 7600 Gaming OC 8G | `length_mm`, `slots`, `tdp_w` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `GPU-GIGABYTE-RX9070XT-GAMING-OC-16G` | Gigabyte Radeon RX 9070 XT Gaming OC 16G | `length_mm`, `slots`, `power_connector`, `tdp_w` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. tdp_w is AMD's reference board power; factory-overclocked boards draw more. |
| `GPU-INTEL-ARC-B580-LE-12G` | Intel Arc B580 Limited Edition 12GB | `length_mm`, `recommended_psu_w` | Card length, slot width and power connector vary by exact board model and revision: check the manufacturer's page. recommended_psu_w is the GPU vendor's figure for the chip. |
| `MB-GIGABYTE-B550M-DS3H` | Gigabyte B550M DS3H | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-MSI-PRO-B650M-A-WIFI` | MSI PRO B650M-A WIFI | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-MSI-MAG-B650-TOMAHAWK-WIFI` | MSI MAG B650 TOMAHAWK WIFI | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-ASUS-TUF-B650-PLUS-WIFI` | ASUS TUF GAMING B650-PLUS WIFI | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-MSI-PRO-B760M-A-WIFI-DDR4` | MSI PRO B760M-A WIFI DDR4 | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-ASUS-TUF-B760-PLUS-WIFI-D4` | ASUS TUF GAMING B760-PLUS WIFI D4 | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `MB-GIGABYTE-Z790-AORUS-ELITE-AX` | Gigabyte Z790 AORUS ELITE AX | `m2_slots`, `max_memory_gb`, `sata_ports` | Slot counts and maximum memory differ between BIOS versions and board revisions. Confirm m2_slots, max_memory_gb and sata_ports on the manufacturer's specification page. |
| `RAM-KINGSTON-FURY-D5-32G-6000` | Kingston FURY Beast DDR5 32GB (2x16GB) 6000MT/s CL40 | `voltage_v`, `profiles` | Voltage and profile support (XMP / EXPO) differ between part-number variants of the same kit. Confirm on the manufacturer's page for the exact part number. |
| `RAM-KINGSTON-FURY-D5-16G-5600` | Kingston FURY Beast DDR5 16GB (2x8GB) 5600MT/s CL40 | `voltage_v`, `profiles` | Voltage and profile support (XMP / EXPO) differ between part-number variants of the same kit. Confirm on the manufacturer's page for the exact part number. |
| `RAM-KINGSTON-RENEGADE-D5-32G-6400` | Kingston FURY Renegade DDR5 32GB (2x16GB) 6400MT/s CL32 | `voltage_v`, `profiles`, `cas_latency` | Voltage and profile support (XMP / EXPO) differ between part-number variants of the same kit. Confirm on the manufacturer's page for the exact part number. |
| `RAM-CORSAIR-VENGEANCE-D5-32G-6000` | Corsair VENGEANCE DDR5 32GB (2x16GB) 6000MT/s CL30 | `voltage_v`, `profiles` | Voltage and profile support (XMP / EXPO) differ between part-number variants of the same kit. Confirm on the manufacturer's page for the exact part number. |
| `RAM-CORSAIR-VENGEANCE-D5-64G-5600` | Corsair VENGEANCE DDR5 64GB (2x32GB) 5600MT/s CL40 | `voltage_v`, `cas_latency`, `profiles` | Voltage and profile support (XMP / EXPO) differ between part-number variants of the same kit. Confirm on the manufacturer's page for the exact part number. |
| `SSD-SAMSUNG-990EVO-1TB` | Samsung 990 EVO 1TB | `read_mbps`, `write_mbps`, `pcie_gen` | Sequential speeds are the manufacturer's headline figures for this capacity and vary by capacity and firmware. The 990 EVO runs as PCIe 4.0 x4 or 5.0 x2. |
| `SSD-SAMSUNG-990PRO-2TB` | Samsung 990 PRO 2TB | `read_mbps`, `write_mbps` | Sequential speeds are the manufacturer's headline figures for this capacity and vary by capacity and firmware. |
| `SSD-WD-BLUE-SN580-1TB` | Western Digital WD Blue SN580 1TB | `read_mbps`, `write_mbps` | Sequential speeds are the manufacturer's headline figures for this capacity and vary by capacity and firmware. |
| `SSD-WD-BLACK-SN850X-1TB` | Western Digital WD_BLACK SN850X 1TB | `read_mbps`, `write_mbps` | Sequential speeds are the manufacturer's headline figures for this capacity and vary by capacity and firmware. |
| `SSD-KINGSTON-NV3-1TB` | Kingston NV3 1TB | `read_mbps`, `write_mbps` | Sequential speeds are the manufacturer's headline figures for this capacity and vary by capacity and firmware. |
| `HDD-WD-BLUE-2TB-7200` | Western Digital WD Blue 2TB 7200 RPM | `cache_mb` | Cache size can differ between revisions of this model. |
| `PSU-CORSAIR-RM750E` | Corsair RM750e | `native_12v_2x6` | Connector naming differs between ATX 3.0 (12VHPWR) and ATX 3.1 (12V-2x6) and between product revisions: confirm native_12v_2x6 on the manufacturer's page. |
| `PSU-MSI-MAG-A850GL-PCIE5` | MSI MAG A850GL PCIE5 | `native_12v_2x6` | Connector naming differs between ATX 3.0 (12VHPWR) and ATX 3.1 (12V-2x6) and between product revisions: confirm native_12v_2x6 on the manufacturer's page. |
| `PSU-MSI-MPG-A1000G-PCIE5` | MSI MPG A1000G PCIE5 | `native_12v_2x6` | Connector naming differs between ATX 3.0 (12VHPWR) and ATX 3.1 (12V-2x6) and between product revisions: confirm native_12v_2x6 on the manufacturer's page. |
| `CASE-NZXT-H5-FLOW` | NZXT H5 Flow | `max_gpu_length_mm`, `max_cooler_height_mm`, `radiator_support_mm` | Clearance figures (GPU length, cooler height, radiator sizes) and supported board sizes come from the maker's spec sheet and can differ between case revisions. Verify before relying on the compatibility badge. |
| `CASE-CORSAIR-4000D-AIRFLOW` | Corsair 4000D AIRFLOW | `max_gpu_length_mm`, `max_cooler_height_mm`, `radiator_support_mm` | Clearance figures (GPU length, cooler height, radiator sizes) and supported board sizes come from the maker's spec sheet and can differ between case revisions. Verify before relying on the compatibility badge. |
| `CASE-LIANLI-LANCOOL-216` | Lian Li LANCOOL 216 | `form_factors`, `max_gpu_length_mm`, `radiator_support_mm` | Clearance figures (GPU length, cooler height, radiator sizes) and supported board sizes come from the maker's spec sheet and can differ between case revisions. Verify before relying on the compatibility badge. |
| `CASE-CM-MASTERBOX-Q300L` | Cooler Master MasterBox Q300L | `max_gpu_length_mm`, `radiator_support_mm` | Clearance figures (GPU length, cooler height, radiator sizes) and supported board sizes come from the maker's spec sheet and can differ between case revisions. Verify before relying on the compatibility badge. |
| `CASE-CM-NR200P` | Cooler Master NR200P | `max_gpu_length_mm`, `max_cooler_height_mm`, `radiator_support_mm` | Clearance figures (GPU length, cooler height, radiator sizes) and supported board sizes come from the maker's spec sheet and can differ between case revisions. Verify before relying on the compatibility badge. |
| `COOL-DEEPCOOL-AK400` | DeepCool AK400 | `sockets`, `height_mm`, `tdp_rating_w` | Socket lists are limited to the sockets sold in this catalogue (AM4, AM5, LGA1700); the maker's list is longer and depends on the mounting kit. Height and the cooling rating are the manufacturer's claims. |
| `COOL-CM-HYPER-212-BLACK` | Cooler Master Hyper 212 Black Edition | `sockets`, `height_mm` | Socket lists are limited to the sockets sold in this catalogue (AM4, AM5, LGA1700); the maker's list is longer and depends on the mounting kit. Height and the cooling rating are the manufacturer's claims. |
| `COOL-NOCTUA-NH-D15` | Noctua NH-D15 | `sockets` | Socket lists are limited to the sockets sold in this catalogue (AM4, AM5, LGA1700); the maker's list is longer and depends on the mounting kit. Height and the cooling rating are the manufacturer's claims. |
| `COOL-CM-MASTERLIQUID-ML240L-V2` | Cooler Master MasterLiquid ML240L V2 RGB | `sockets` | Socket lists are limited to the sockets sold in this catalogue (AM4, AM5, LGA1700); the maker's list is longer and depends on the mounting kit. Height and the cooling rating are the manufacturer's claims. |
| `COOL-CM-MASTERLIQUID-ML360L-V2` | Cooler Master MasterLiquid ML360L ARGB V2 | `sockets` | Socket lists are limited to the sockets sold in this catalogue (AM4, AM5, LGA1700); the maker's list is longer and depends on the mounting kit. Height and the cooling rating are the manufacturer's claims. |
| `LAP-LENOVO-LOQ-15IRX9` | Lenovo LOQ 15IRX9 | `cpu_model`, `gpu_model`, `ram_gb`, `storage_gb`, `battery_wh` | Laptop configurations differ by regional SKU and reseller (CPU tier, GPU, memory, storage, battery, panel). Confirm every spec against the exact model number sold. |
| `LAP-ASUS-TUF-A15-FA507NV` | ASUS TUF Gaming A15 FA507NV | `cpu_model`, `ram_gb`, `storage_gb`, `battery_wh` | Laptop configurations differ by regional SKU and reseller (CPU tier, GPU, memory, storage, battery, panel). Confirm every spec against the exact model number sold. |
| `LAP-ASUS-ZENBOOK-14-OLED-UX3405MA` | ASUS Zenbook 14 OLED UX3405MA | `cpu_model`, `ram_gb`, `storage_gb`, `battery_wh` | Laptop configurations differ by regional SKU and reseller (CPU tier, GPU, memory, storage, battery, panel). Confirm every spec against the exact model number sold. |
| `LAP-LENOVO-THINKPAD-E14-G5` | Lenovo ThinkPad E14 Gen 5 | `cpu_model`, `ram_gb`, `storage_gb`, `battery_wh` | Laptop configurations differ by regional SKU and reseller (CPU tier, GPU, memory, storage, battery, panel). Confirm every spec against the exact model number sold. |
| `MON-LG-27GP850-B` | LG UltraGear 27GP850-B | `refresh_hz`, `response_ms` | Refresh rate (native vs overclocked), response time (GtG vs MPRT) and ports differ between panel and firmware revisions. Confirm on the manufacturer's page. |
| `MON-GIGABYTE-M27Q` | Gigabyte M27Q | `refresh_hz`, `response_ms`, `adaptive_sync` | Refresh rate (native vs overclocked), response time (GtG vs MPRT) and ports differ between panel and firmware revisions. Confirm on the manufacturer's page. |
| `MON-SAMSUNG-ODYSSEY-G5-34` | Samsung Odyssey G5 LC34G55T | `response_ms` | Refresh rate (native vs overclocked), response time (GtG vs MPRT) and ports differ between panel and firmware revisions. Confirm on the manufacturer's page. |
| `MON-LG-24MR400-B` | LG 24MR400-B | `screen_size_in`, `response_ms` | Refresh rate (native vs overclocked), response time (GtG vs MPRT) and ports differ between panel and firmware revisions. Confirm on the manufacturer's page. The panel is 23.8 inches; it is listed as 24. |
| `MON-LG-27UP850N-W` | LG 27UP850N-W | `response_ms`, `adaptive_sync` | Refresh rate (native vs overclocked), response time (GtG vs MPRT) and ports differ between panel and firmware revisions. Confirm on the manufacturer's page. |
| `KB-REDRAGON-K552-KUMARA` | Redragon K552 Kumara | `backlight` | Peripheral specs vary by regional model and revision. Confirm on the manufacturer's page. Several K552 variants exist with single-colour or RGB lighting. |
| `KB-LOGITECH-MX-KEYS-S` | Logitech MX Keys S | `connectivity` | Peripheral specs vary by regional model and revision. Confirm on the manufacturer's page. |
| `HS-HYPERX-CLOUD-II` | HyperX Cloud II | `connectivity` | Peripheral specs vary by regional model and revision. Confirm on the manufacturer's page. |
| `NET-TPLINK-ARCHER-AX55` | TP-Link Archer AX55 | `max_speed_mbps` | Wireless speed figures are combined theoretical rates on the manufacturer's spec sheet, not real throughput. |
| `NET-TPLINK-ARCHER-TX20E` | TP-Link Archer TX20E | `max_speed_mbps` | Wireless speed figures are combined theoretical rates on the manufacturer's spec sheet, not real throughput. |
| `ACC-LOGITECH-G640` | Logitech G640 | `lengthMm`, `widthMm` | Dimensions (460 x 400 x 3 mm) are from memory of the manufacturer's page. |
<!-- seed:generated:end -->
<!-- prettier-ignore-end -->
