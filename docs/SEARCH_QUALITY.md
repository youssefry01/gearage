# Search quality report (M4a)

Measured on the seeded catalog (79 products, 6 bundles) with the real pipeline, PostgreSQL 18.4, 2026-10-25.
**This is a small, synthetic catalog: it proves the rules work, not how search will feel at 10,000 products.**
Re-measure on real data before launch. The source of truth is the table in
[`tests/db/search.db.test.ts`](../tests/db/search.db.test.ts); this file explains it.

Try your own queries against any database (read-only):

```
npm run search:try -- "rtx 4060" "كارت شاشة" "ryzn 5 5600"
npm run search:try -- --limit 10 "samsung 990"
```

## Result: 73 expectation rows, all met

| Group (rows)   | What is asserted                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Exact (50)     | Model numbers in any spelling, product-type words, brands, units, Arabic and English                     |
| Corrected (15) | A misspelled word is replaced by the closest catalog word, the page says so, and the right products lead |
| None (6)       | Things we do not sell return nothing, instead of something plausible-looking                             |
| Partial (2)    | Some words match; labelled as such; products matching more words come first                              |

30 of the 73 queries are Arabic (letter variants, colloquial spellings, brand transliterations, Arabic digits, mixed
Arabic/Latin, plural and singular).

## What works well

- **Model numbers however they are written:** `rtx 4060`, `RTX4060`, `rtx-4060`, `4060` and `٤٠٦٠` return the same three
  products; `990pro`, `ryzen5 5600`, `i5-14400F`, `7800x3d`, `b650`, `ddr5 32gb`.
- **English and Arabic names of a product type lead with the same products:** `gpu`, `graphics card`, `كارت شاشة`,
  `كرت الشاشه`, `كروت الشاشة` all put the same nine graphics cards first. Same for processors, motherboards (`لوحة ام`,
  `مازربورد`, `اللوحات الأم`), memory, power supplies (`باور سبلاي`), cases, coolers, laptops, keyboards, mice, routers.
- **Brands, including Arabic spellings the catalog does not contain:** `انفيديا`, `ايسوس`, `سامسونج`, `كينجستون`.
- **Typos:** `ryzn 5 5600`, `nvidea`, `corsiar vengance`, `kingstone`, `samsng 990`, `motherbord`, `keybord`, `procesor`,
  `graphcs card`, and Arabic `معلج`, `انفديا` (a typo in an Arabic brand spelling), `لينوفوو`, `ايسوز`.
- **Prefixes are not typos:** `lapto`, `gigabyt` match directly.
- **Honest misses:** `x870`, `gtx 1080`, `4070`, `playstation`, `seasonic`, `xyzzy` return nothing.
- **Never a surprise:** the same search twice gives the same order; pages never overlap; draft, archived and deleted
  products never appear even though they are indexed; a model number never matches by joining unrelated words
  (`2tb` is not "2" somewhere and "tb" elsewhere).

## Known limitations (measured, not hypothetical)

1. **A typo inside a model number is not corrected** (`rtx 4o60`). By design: `4060` and `4070` are different
   products, so anything containing a digit is never auto-corrected. The query falls back to partial RTX results, and
   says so.
2. **`شاشة` alone also returns graphics cards**, because their Arabic titles contain "كارت شاشة" (the typed word may
   match anywhere). Monitors rank first, but the count includes the GPUs. The fix is a richer Arabic title convention
   or a phrase-aware rule, not more synonyms.
3. **Bundles appear for a part's model** (`b650`, `rtx 4060`, `samsung 990 pro`), after the part itself. Intended;
   they do not appear for generic words (`gpu`, `معالج`).
4. **A "2x32GB" kit matches `32gb`**: technically right (the modules are 32 GB), possibly not what the shopper meant.
5. **Descriptions can match** a typed word (a fan's description mentions "case"), ranked below title matches.
6. **No Arabic stemming beyond the article "ال"**: plurals and spelling variants are covered only by the synonym list
   (`src/domain/search-synonyms.ts`, 51 groups). Machine-written; **needs native review** (listed in
   `docs/I18N_REVIEW.md`). A missing Egyptian colloquial form means no results for that word.
7. **Partial matches can be loosely related** (`rtx 4070` shows other RTX cards). They are labelled, and need at least
   one real word match; a model number alone never qualifies a product.
8. **The Arabic spelling of the brand Gigabyte is also how the unit "gigabyte" is transliterated**; it is treated as
   the brand (the unit is written "جيجا").
9. **Scale is unmeasured.** GIN-indexed full-text search and a trigram index over a vocabulary are standard at tens of
   thousands of products, but nothing was benchmarked beyond 85. Measure with `EXPLAIN ANALYZE` on real volume
   (HANDOFF issue 56).

## Locale independence

`pg_trgm` produces **no trigrams for Arabic when the database locale is plain `C`** (measured). The vocabulary index
therefore runs over `search_ascii_key` (each Arabic letter mapped to its own ASCII letter), and all 129 search database
tests pass on both a `C.utf8` and a plain `C` database.
