# ADR 0020: Product comparison and recently viewed (M4b)

Status: Accepted

## Context

The brief asks for comparison of up to four products, and a "recently viewed" shelf. Neither needs an account, and
both must work for guests. View COUNTING (best sellers, most viewed) is a different feature that needs a write
endpoint and the rate limiter from M5a; it is not part of this milestone.

## Decisions

1. **The compare list and the recently viewed list live on the device** (`localStorage`, Zustand `persist`, manual
   hydration like the cart). Nothing is sent to the server and there is no account link. Both stores validate
   everything read back (`domain/compare-storage.ts`, `domain/recently-viewed.ts`): localStorage is untrusted input
   (slugs must match the slug pattern, images must be own-origin paths, the list is capped, a list with two groups
   keeps the first). The stored compare entry carries a small display snapshot (title in both languages, thumbnail)
   so the tray needs no request; the comparison page itself always reads fresh data.
2. **The comparison is a server-rendered page driven by the URL**: `/compare?p=slug,slug` (and `&diff=1`). It is
   shareable, works without JavaScript and is `noindex, follow` with a bare canonical. `/compare` without `p` opens
   the device's list (a client redirect to the URL form) or explains how to start. Products that are hidden, deleted
   or unknown are reported ("no longer available") and removed from the device list, never shown.
3. **What can be compared with what** (`domain/compare.ts`, pure and tested): at most 4 products; only products of
   the same group. A group is the **spec family**, the category that owns the spec definitions (`specOwnerPath`, the
   same nearest-ancestor rule the product page uses): an NVIDIA and an AMD graphics card are one family
   (`components/graphics-cards`), a graphics card and a processor are not. **Bundles compare with bundles only**
   (resolves the open decision in ADR 0010 for compare). Gift cards and digital products are not comparable. The
   compare group is computed on the server and travels on the card (`ProductCardData.compareGroup`), because the
   browser does not know the category tree. The first version grouped by leaf category and refused NVIDIA against
   AMD; a DB test and an e2e test now pin the family rule.
4. **The table** (`domain/compare-table.ts`, pure and tested): overview rows (price, savings, availability, brand,
   model, condition, warranty), then one row per spec definition of the family in definition order (rows nobody has
   a value for are left out; a missing value shows "Not listed"), or for bundles one row per kind of part (per spec
   family, so all CPUs share a row whatever the brand), a summary (memory, storage, power supply) and a
   compatibility status computed by the same rules as the bundle page. A row "differs" when the values are not all
   equal; stock is compared as buyable or not, never by quantity. "Show differences only" is a link (URL state).
   A bundle has no single warranty row (warranty is per component, issue 44).
5. **No "best value" or winner highlighting.** Specs have no defined direction (higher is better for VRAM, lower for
   TDP), and the seed specs are unverified, so the page marks differences and nothing more.
6. **Statements are bounded.** A comparison runs one products statement, one parts statement (bundles only) and
   cached spec and category lookups, however many products (at most four); the recently viewed cards run the shared
   listing query once (rows and total) with a new `slugs` filter, so the visibility rule is the same everywhere.
7. **Recently viewed** records a slug when a product page renders (the page answers 404 for products a shopper
   cannot see, so a hidden product is never recorded), keeps 12, shows up to 8 (never the product being viewed) on
   the product page and the home page, fetches the cards fresh from `GET /api/products/cards?slugs=` (bounded to 12
   valid slugs, 422 otherwise, `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`), and
   drops products that came back missing. "Clear history" is on the shelf. The endpoint has no per-IP rate limit until
   M5a (HANDOFF issue 64).
8. **Where "Compare" is offered**: on cards in listings, search results and related/included-in products, and on
   the product page; not on the home shelves (clutter, and 40 more client components to hydrate there). It is a
   checkbox whose real input fills the 44px label. Refusals (list full, other family) are shown and announced in
   the tray. The tray sits after the footer in the page flow (sticky at the bottom), reserves its height as
   `scroll-padding-bottom` so it never covers a focused element, and is covered by the cookie banner while that is
   open.

## Consequences

- Privacy: the two lists are stored in the browser only. The cookie policy and consent text (M12) must describe
  them as functional storage and the legal review must confirm that no consent is needed for them (HANDOFF issue 65).
- The tray shows thumbnails only for own-origin images; with Supabase Storage URLs it falls back to an icon until a
  remote image host is configured for `next/image`.
- Add-to-cart from the comparison page is not offered: the cart lands in M6a, and cards have no add-to-cart either.
