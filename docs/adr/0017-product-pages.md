# ADR 0017: Product and bundle pages (M3b)

Status: accepted (M3b, 2026-10-24)

## Context

M3b ships the page behind every card: parts and fixed bundles at `/p/<slug>`. It must be correct under the bundle rules (derived stock, snapshot-ready pricing), safe with admin-entered media, indexable, accessible and responsive in LTR and RTL, and honest while the catalog is the illustrative demo seed.

## Decisions

### One visibility rule

`VISIBLE_PRODUCT` (`src/server/repositories/visibility.ts`) is the single SQL condition for "a shopper may see this": ACTIVE, not soft-deleted, in an active category, brand active or absent. Listings, the product page, related products, the bundle parts' links and the sitemap all use it, so a product cannot be listed but 404, or the reverse. Anything else answers a real 404 (draft, archived, deleted, inactive brand or category, malformed slug; a malformed slug never reaches the database).

### Statements per page (no N+1, tested)

Product row (price and availability come from the two SQL views, so cards and pages agree), media (images, showcase blocks, tags: 3 small reads in parallel), spec definitions (cached 60 s), and for a bundle one parts query (specs, price, stock, brand, first image, link-ability via a LATERAL join) plus its pricing row; for a part, the bundles that include it; related products. A DB test asserts a 5-part and a 9-part bundle cost the same number of statements.

### Bundles

- Price, "you save" and stock come from the same views as the listing; the domain quote is cross-checked against the view in a DB test for every seeded bundle.
- A part whose stock is below its quantity is flagged "not enough in stock"; an archived or deleted part is flagged "no longer sold" and is not linked. Either makes the bundle unavailable (the view already derives that).
- Compatibility and the build summary (memory, storage, PSU, estimated draw) are computed by the pure rules module the PC Builder will reuse. Messages are keyed by the rule's `messageKey`; a unit test reads the rules' source and fails if a key or a placeholder is missing in any locale.
- A bundle shows no single warranty: warranty is per component (returns and invoices work per component, ADR 0010).

### Manufacturer showcase

Images are our own stored copies, rendered with alt text and `loading="lazy"` (SVG placeholders `unoptimized`, raster through `next/image`). Videos: `parseVideoEmbed` allow-lists YouTube only and REBUILDS the iframe URL from the validated 11-character id on `www.youtube-nocookie.com`; hostile inputs (lookalike hosts, userinfo, ports, `javascript:`, extra paths) are rejected in unit tests. The iframe is a click-to-load facade: no request to YouTube until the shopper presses play. Only the credit line is public; the license note stays an admin/ASSETS.md matter.

### Structured data

`BreadcrumbList` on category and product pages (absolute URLs, the current page's canonical). `Product` on product pages. While `CATALOG_DEMO_NOTICE` is on, the Product JSON-LD OMITS `offers`: illustrative prices must not be published to search engines. No `aggregateRating` until real reviews exist (M8a). JSON-LD is serialized with `<` escaped so a title cannot close the script element. SVG images are left out of structured data and Open Graph (platforms ignore them); the brand image is the fallback.

### Zoom, gallery, cart button

Zoom is a Radix dialog viewer (focus trap, Escape, focus returns to the real `Dialog.Trigger`, arrow keys follow what is on screen in RTL), not hover magnification, so it works with touch, keyboard and screen readers. The first image is server-rendered. The add button uses the existing minimal cart store, with the picker capped by stock and 10 per line (`purchasableLimit`, `clampQuantity`); this is a convenience limit only and checkout (M6) re-validates. M6a replaces the line model but keeps `useCartStore`.

### Rendering and caching

Dynamic, like the listings (stock and price per request, a handful of indexed statements; `cache()` shares one load between metadata and page). Cache Components / ISR is a measured decision for M13a. `/sitemap.xml` is dynamic too, with its own last-good cache (below).

### Sitemap resilience

`lastGood()` (`src/server/cache/last-good.ts`): fresh for an hour; on a failed refresh it serves the last good list, or the static pages only on a cold start, never throws, retries after 30 s, and does not remember a degraded answer as good. The route is `force-dynamic` because with `revalidate` Next would have cached the degraded answer for the full hour.

## Not in M3b

Reviews and rating distribution (M8a), recently viewed and view tracking (M4), "frequently bought together" (needs order data), dynamic OG images (M13a), delivery estimates from shipping zones (M6a: the page says the fee and time are shown at checkout), customize/swap parts (M14+).

## Consequences

Seed prices and the 88%-of-price costs remain illustrative, so everything price-derived on these pages carries the demo notice. The seeded video id is still unverified (HANDOFF issue 34).
