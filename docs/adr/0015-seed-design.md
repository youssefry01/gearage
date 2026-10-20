# ADR 0015: Catalog seed design

Status: accepted (M2b)

## Context

The brief asks for an idempotent seed of realistic catalog data (categories, spec definitions, brands, products, bundles,
shipping zones, promo codes, branches) with generated placeholder images, safe to re-run and safe to point at the wrong
database by mistake. M2a left open how specs are attached to categories and how numeric lists are stored.

## Decisions

1. **Diff-then-write, not `upsert`.** Prisma's `upsert` always sets `@updatedAt`, so a re-run would touch every row. The seed
   reads each row by natural key (category `path`, brand/tag `slug`, product `sku`, spec `(category, key)`), compares the
   seed-managed fields with deep equality, and writes only on a difference. A second run changes nothing, and a test proves
   it by comparing every row of every table. Products are matched on SKU because the SKU unique index is partial (live
   rows only), which Prisma cannot target with `upsert`.
2. **Create-once for live data.** Stock (via `restockUnits`, `RECEIVED`, so history is real), `viewCount` and `unitsSold` are
   set at creation only. Re-seeding must never undo sales or adjustments made while developing.
3. **Additive, one transaction.** The seed adds and updates, never deletes (a bundle's composition is the exception: it is owned
   by the data file). The database part runs in one interactive transaction so a failure leaves nothing half-seeded.
4. **Validation before writes.** `validate.ts` checks cross-references, spec values against definitions, the spec keys the
   compatibility rules need, price sanity and the data-only files, and reports every problem at once.
5. **Spec definitions inherit.** Definitions live on the category that owns a family; a product uses the nearest ancestor that has
   definitions (`resolveSpecDefinitions`, pure and tested), so sub-categories (brand or type) need no copies, and a sub-category
   can override (case fans under cooling). Case fans are also excluded from the build roles (`roleOfCategoryPath`), found
   when seeding: they sat under the `cooler` prefix and would have been misread as coolers by the PC Builder.
6. **Numeric lists as `STRING_LIST`.** Case radiator sizes are stored as integers-as-strings (`"360"`). The compatibility module
   now accepts numeric strings. A real `NUMBER_LIST` spec type would need a DB enum migration for no behavioural gain; revisit
   if a numeric-list filter is ever needed.
7. **Bundles hold editorial specs only.** `use_case` and `target_resolution`. Hardware summaries are derived from components so
   they cannot drift. All seeded bundles use `FIXED` pricing (approved default) and must pass the compatibility rules with
   zero warnings and zero unknowns (tested against the real DB services).
8. **Data-only files for tables that do not exist yet.** Shipping zones, promo codes and branches are typed, validated and
   documented but not inserted until M6a / M12 add their tables. Inventing placeholder tables now would pre-empt those designs.
9. **Placeholders are generated SVG, written through the storage provider.** Deterministic (same input, same bytes), labelled
   "ILLUSTRATIVE PLACEHOLDER", no real products or logos, escaped text, no scripts. The seed is the only SVG writer
   (`allowSvg`); admin uploads still refuse SVG. Keys live under `seed/` so they are easy to find and replace.
10. **Local-only, twice.** `prisma/seed/index.ts` and `runSeed` both call the local-host guard (the Prisma CLI guard does not see
    `tsx prisma/seed/index.ts`). The entry also refuses a non-local storage provider.
11. **Honest accuracy.** Specs come from the author's knowledge. Anything uncertain is flagged in the data (`verify`) and listed
    in a generated section of `docs/SEEDING.md`; the generated list is CI-checked so flags cannot silently disappear.

## Consequences

- Seeding is fast to re-run and cheap to extend (one file per family).
- Spec accuracy still depends on a human check against manufacturer pages before launch.
- Arabic seed copy is machine-written and listed in `docs/I18N_REVIEW.md` (generated, CI-checked).
