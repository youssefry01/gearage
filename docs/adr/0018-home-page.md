# ADR 0018: Home page (M3a-2)

Status: accepted (M3a-2, 2026-10-24)

## Context

The home page is the first page most visitors see and the only one that mixes every kind of catalog data: categories, brands, bundles and five different "best of" selections. It must be built only from the database (no invented numbers), stay honest while the catalog is illustrative demo data, work in both languages and both themes down to 320px, and never link anywhere that 404s.

## Decisions

### Sections and how each is selected

All rails reuse the listing engine (`queryListing` with `withFacets: false`), so a card on the home page is the same card, from the same price and availability views, as in a listing. The rules live in `src/domain/home.ts` (pure, unit-tested):

| Rail         | Selection                                                                 |
| ------------ | ------------------------------------------------------------------------- |
| Deals        | on sale (real compare-at or bundle saving), sorted by discount percentage |
| Featured     | tag `featured`, popularity order                                          |
| Best sellers | units sold, descending                                                    |
| New arrivals | creation date, newest first                                               |
| Most viewed  | view count, descending (the `popular` sort)                               |

- **In stock only.** Every rail filters to purchasable products: an out-of-stock best seller on the front page is a dead end. Out-of-stock products stay in listings.
- **No cross-rail de-duplication.** A rail's name is a claim ("Best sellers" must be the real best sellers), so the same product can appear in two rails. The only exception is the hero bundle, which is removed from the Featured rail it was picked from.
- A rail with no products renders nothing (no heading over an empty shelf). If the whole catalog is empty, the page shows a neutral "being set up" message.
- Rails have no "view all" link yet: there is no all-products or deals listing to point at (see HANDOFF, open items).

### Hero

One featured bundle shown as a **parts list** (quantity × part, then price and "you save"), because a parts list at one price is the most characteristic thing this store sells. All numbers are the bundle's view values; the parts come from one statement (`fetchBundleParts`). The measurement-grid motif (the same graph paper as the generated placeholder art) sits only behind the image, never behind text, so contrast is always measured against a solid surface. With no featured bundle the hero is text only.

The hero copy makes no claims about delivery, authenticity, warranty or compatibility: those are not verified facts yet (HANDOFF launch blockers). The brand tagline ("PC hardware, delivered across Egypt.") is NOT used on the page for the same reason (see HANDOFF known issue 47).

### Category tiles and brand strip

- Tiles are the top level of the storefront category tree, so an inactive or empty category never gets one. The whole tile is the link (large touch target); its picture is decorative because the name sits under it. The tile image is cropped to 16:9 from the top, which also hides the caption baked into the placeholder art.
- The brand strip lists brands that have visible products, most products first (14 shown). Brands are shown as **text**, not logos: real logos must come from official media kits (docs/ASSETS.md) and the seeded wordmark tiles are placeholders. There are no brand pages yet, so each chip opens the top-level category where the brand sells most, filtered to that brand (an ordinary `noindex` filter URL, ADR 0016). The category is chosen only among categories that exist in the storefront tree, so a chip can never point at a 404 (tested over HTTP in e2e).

### Rendering and caching

Static with ISR: `export const revalidate = 300`. Verified against the installed Next docs: a literal `revalidate` is valid with Cache Components off (this project), it must be statically analyzable (a literal number), and the lowest value across layout (3600) and page wins, so the whole home route regenerates every 5 minutes (header and footer data included).

With no `DATABASE_URL` (the CI `verify` build) the page renders without sections. With one configured, a database error propagates on purpose: a failed regeneration keeps serving the last good page instead of caching an empty home page (same rule as the category tree).

Statements per regeneration: five rails (rows + total each), brand counts (1), hero parts (1); the category tree is cached. All bounded by the section sizes, none per product, brand or category.

### Structured data

`Organization` (name, URL, logo) and `WebSite` (name, URL, language) only. No contact points or social profiles (editable store settings, not final) and no `SearchAction` until `/search` exists (M4): claiming a search action that points at a placeholder would be wrong. No `offers` anywhere on the page (ADR 0017: illustrative prices are not offers while the demo notice is on). The demo notice is shown under the hero.

### Mobile layout

Below `lg` each rail is a swipeable scroll-snap row that bleeds to the screen edges (the scroll is inside the list, so the page never scrolls sideways; the next card peeks to signal more); from `lg` it is a 4-column grid. No carousel library is added: scroll-snap needs no JavaScript and works with touch, keyboard focus and RTL.

## Consequences

- A shared `ProductCard` defect was found by the new page and fixed: the title link was only as tall as one line of text on wide cards (28px, below the 44px target rule). The link now has a 44px box with the line clamp inside it. Listings are unaffected visually except one-line titles, which get a taller hit area.
- Two older e2e specs assumed the placeholder home (h1 = logo; instant hydration). They now assert the new contract and wait for hydration (`whenHydrated`).
- Open for later: an all-products/deals listing and brand pages (so rails and brand chips can link to a full view), real brand logos, admin-editable featured selection (M10a).
