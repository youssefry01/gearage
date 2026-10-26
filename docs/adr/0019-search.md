# ADR 0019: Search and discovery (M4a)

Status: Accepted (refines [ADR 0005](0005-search.md))

## Context

Shoppers in Egypt type in Arabic and English, mix them ("رام 32 GB"), write model numbers any way ("rtx4060",
"RTX-4060", "rtx 4060"), misspell brands, and use Arabic transliterations of brands that the catalog stores only in
Latin. The catalog is small today (85 products) and must stay correct, not just fast, at tens of thousands.

## Decisions

1. **One document per product, both languages, not one per locale.** A shopper on the English site types Arabic and
   vice versa, so every document holds English and Arabic text. Weights: A title, brand (en/ar), model, MPN, SKU;
   B category chain and tags; C short descriptions; D spec text values and, for a bundle, its parts' brand and model.
   The document covers every non-deleted product; visibility (ACTIVE, active category and brand) is applied at query
   time by the shared `VISIBLE_PRODUCT` rule, so a status change never needs a reindex.
2. **Kept current by triggers, not by application code.** Triggers on `product`, `product_tag`, `bundle_item`,
   `brand`, `category` and `tag` rebuild affected documents inside the same transaction as the change, so no
   forgotten code path can leave search stale (admin CRUD, CSV import and the seed all just work). A daily job does a
   full rebuild as a safety net; a database test proves the rebuild is a no-op, and another proves no document ever
   differs from a fresh build.
3. **Normalization in SQL and TypeScript, proven identical.** `search_normalize`, `search_fold` and
   `search_ascii_key` (SQL, IMMUTABLE) have TypeScript twins in `domain/search-normalize.ts`. A database test compares
   them on a corpus and 600 random strings over Latin, Arabic letters, diacritics and digits. Rules: lower-case;
   alef forms to alef, alef maksura to ya, ta marbuta to ha, hamza on waw/ya dropped; Arabic-Indic and Persian digits
   to 0-9; tashkeel and tatweel removed; Arabic and Latin/digits split apart ("وRTX" -> "و rtx"); punctuation to
   spaces; the "ال" prefix stripped from words with three or more further letters (a light stemmer); no other
   stemming.
4. **Model numbers match however they are written.** The index stores each word and its letter/digit-split form;
   the query tries the whole token and, when every letter part has two or more characters, the parts as an adjacent
   phrase (`2 <-> tb`, never "2" and "tb" anywhere). Tokens of three or more characters match as prefixes.
5. **Synonyms are data** (`domain/search-synonyms.ts`): product types, units and brands, English and Arabic, with
   Egyptian colloquial forms ("كرت شاشه", "باور سبلاي"). A synonym expansion may match only title, brand, model,
   categories and tags (weights A and B); the words the shopper actually typed match everywhere. This is what stops
   "كارت شاشة" matching a case whose description mentions "graphics cards".
6. **Typo tolerance on the catalog's own vocabulary, in three tiers.** Exact; then, only when nothing matched and no
   filter is active, each unknown word is replaced by the closest vocabulary word and the search repeated ("corrected",
   and the page says so); then the products matching at least one word ("partial", ranked by how many words matched,
   and the page says so). Only words are corrected, never anything with a digit (4060 and 4070 are different
   products). Candidates come from trigram similarity; the choice is edit distance (adjacent swap = 1) then document
   frequency, deterministic. Synonym words are candidates too (Arabic brand spellings exist nowhere else). A partial
   match needs at least one word term: a model number alone never qualifies a product.
7. **`pg_trgm` runs on an ASCII key, not on the words.** With a plain `C` database locale `pg_trgm` produces no
   trigrams for Arabic (measured), which would silently disable Arabic typo correction. `search_ascii_key` maps the 29
   Arabic letters one-to-one to ASCII, and the trigram index is an expression index over it. Works in every locale.
8. **Relevance order:** title contains the typed phrase (also in split form), then weighted `ts_rank_cd` (partial
   results: number of matched words first), then purchasable before sold out, then view count, then id. Deterministic,
   so pagination is stable.
9. **The results page is the all-products page.** `/search` with no term lists the whole catalog; "deals", "best
   sellers", "new arrivals" and "most viewed" are sorted/filtered views of it, and each home rail's "View all" link is
   the rail's own filters (a DB test checks the first products of the page are exactly the rail). `/deals` redirects
   (307) to the deals view. Search results are never indexed (`noindex, follow`, self canonical, no hreflang).
10. **Suggestions** (`/api/search/suggest`): products (same ranking and tiers), categories and brands (matched in
    memory from the cached tree and brand list), cacheable at the CDN, 2-character minimum, debounced and aborted by the
    client. No shared rate limiter exists until M5a (HANDOFF issue 15 applies).
11. **Zero-result analytics without personal data:** one row per day and normalized term with a count; no user,
    session or address; terms with an "@" or long digit runs are never stored; at most 5,000 distinct terms a day;
    pruned after 90 days by a daily job. The write runs after the response (`after()`).

## Not done (and why)

- **No TanStack Query yet.** The one client-side fetch (suggestions) uses `fetch` + `AbortController` and a session
  cache; adding a library to every page for it is not worth it. Revisit in M6a with cart mutations.
- **No external search engine.** Revisit (Meilisearch/Typesense behind a `SearchProvider`) only if measured quality or
  latency at real catalog size requires it.
- **No Arabic stemming beyond the article.** Plurals and spelling variants are handled by the synonym list; a real
  stemmer would add false matches. Native review of the list is the quality lever.

## Consequences

- Any new text that should be searchable must be added to `search_build_vector` (a migration), and the no-drift test
  will fail until it is.
- A hand-written migration: run `prisma migrate diff` after `migrate dev` (HANDOFF issue 21).
