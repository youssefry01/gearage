# ADR 0016: Listing URLs, filters, SEO policy and caching (M3a-1)

Status: accepted (M3a-1, 2026-10-21; not-found decision amended 2026-10-22)

## Context

Category pages need filters (brand, price, availability, sale, tags, category-specific specs), sorting and pagination. Filters multiply URLs; without a policy search engines index near-duplicate pages and waste crawl budget. The filter set must follow the category's `SpecDefinition` filter config, and one request must not trigger per-product or per-facet queries.

## Decisions

### URL grammar (all in `src/domain/listing.ts`, pure and tested)

`brand=<slug>` and `tag=<slug>` (repeatable), `price_min` / `price_max` (whole EGP), `in_stock=1`, `sale=1`, `spec.<key>=<value>` (repeatable, checkbox specs), `spec.<key>=<lo>..<hi>` (range specs), `spec.<key>=1` (toggle specs), `sort=<sort>`, `page=<n>`.
Unknown or invalid parameters (including tracking parameters) are dropped silently, never an error. The canonical query string has a fixed parameter order, sorted values and no defaults, so equivalent URLs serialize identically.

### Index policy

| URL                                                   | Indexable             | Canonical              | hreflang                      | In sitemap |
| ----------------------------------------------------- | --------------------- | ---------------------- | ----------------------------- | ---------- |
| `/c/<path>` (clean)                                   | yes                   | itself                 | en, ar, x-default             | yes        |
| `/c/<path>?page=N` (N >= 2, nothing else)             | yes                   | itself, with `page`    | en, ar, x-default (same page) | no         |
| any filter or non-default sort (with or without page) | no: `noindex, follow` | its own normalized URL | none                          | no         |
| junk or tracking parameters only                      | as the clean URL      | the clean URL          | as clean                      | no         |

Rationale: a `noindex` page must not point its canonical at a different URL (mixed signals), so filtered URLs canonicalize to themselves in normalized form; they stay out of hreflang clusters because a noindex page does not belong in one; pagination stays indexable so deep products remain discoverable through crawlable `?page=N` links. Filtered pagination links carry `rel="nofollow"`. Filter controls are form controls, not anchors, so crawlers only reach filtered URLs through links we render on purpose (chips, pagination). Pages past the last page are not-found.

### Numbered pagination, not infinite scroll

Crawlable, shareable, accessible, and the URL always says where you are. Page size 24.

### Filters follow the SpecDefinition config

Only `filterable` definitions with a `facet` are honoured; ENUM values must be real options. The facet counts are disjunctive (each facet is counted with every other filter applied, but not its own), so choosing one socket does not hide the others. One request is exactly three SQL statements (rows, total, all facet counts as one `UNION ALL`), independent of the number of products, facets or options; a DB test asserts the statement count. Spec predicates are checked against an independent TypeScript implementation for every seeded facet.

### Sorting

`popular` (default; in-stock first, then views, then units sold), `best-selling`, `newest`, `price-asc`, `price-desc`, `discount`. Rating sort and filter wait for reviews (M8a). Every sort ends with the product id so pagination is stable. Bundle prices come from the `product_pricing` view, never `product.price`.

### Caching

`unstable_cache` is superseded by Cache Components (`use cache`) in Next 16, and Cache Components removes the `revalidate` segment config the locale layout relies on. Adopting it is an app-wide change, so M3a does not: listing pages are dynamic (they read `searchParams`), and only reference data (category tree, spec definitions) is cached in-process for 60 s with single-flight loading (`src/server/cache/ttl.ts`). On serverless that is per warm instance: it smooths bursts, it is not a shared cache. Measure in M13a (Lighthouse, TTFB) and decide then whether to migrate to Cache Components.
With a configured database, a failing tree load propagates (a static page keeps its last good version); with no `DATABASE_URL` (the CI verify build) the tree is empty.

### Not-found status

Unknown or inactive categories and page numbers past the last page are real HTTP 404s. The category route has no `loading.tsx` on purpose: a route-level loading boundary makes Next stream the response before `notFound()` runs, and a streamed response is committed as 200 (Next then only adds `noindex`). Trade-off: no instant skeleton when navigating between listings. Next adds the not-found `noindex` tag itself (server-inserted plus a client boundary copy), which we cannot control; the server HTML carries exactly one.

### Honesty about data

While the catalog is the illustrative seed, every listing shows a demo-catalog notice (`CATALOG_DEMO_NOTICE`, on unless the value is exactly `false`). Savings are shown only when real fields support them: the compare-at price for physical products, the parts total for bundles.

## Consequences

Filters, URL grammar and policy are unit-tested without a browser; SQL is tested on real PostgreSQL. The `jsonb ->>` comparisons do not use the GIN index on `specs`; fine at this scale, revisit with thousands of products (the `@>` form is index-friendly).
