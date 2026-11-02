# ADR 0023: Anonymous view tracking

Status: Accepted (M5a-1)

## Decisions

- **What is stored:** one row per product and UTC day (`product_view_daily`) and the running `product.viewCount` that the "most viewed" shelf sorts by. No visitor identifier is stored anywhere.
- **Endpoint:** `POST /api/products/view` with `{slug}`, sent by the product page (`RecordView`). **No cookie and nothing on the device.** Always 204 for a valid request, whether or not the view was counted, so the answer reveals nothing (not the dedupe, not the bot filter, not whether the slug exists). 422 for a malformed body, 413 for an oversized one, 429 over the per-IP limit. A cross-origin POST is ignored.
- **Dedupe:** the visitor is `HMAC(key derived from AUTH_SECRET and the UTC day, ip + user agent)`. The key changes every day, so a visitor cannot be linked across days or reversed, and the hash is never stored: it only keys the limiter counter "one view per visitor, product and 30 minutes" (which itself stores only a second HMAC).
- **Bots:** an obvious-automation user agent (or none) is not counted (`isLikelyBot`).
- **Hidden products:** counted only when the shopper-visibility rule holds (active, not deleted, active category and brand), in one SQL statement.
- **Failure:** fail open and quiet. If the limiter cannot answer, the view is simply not counted.
- **Not a privacy-sensitive store:** because nothing is kept per person, it needs no consent. The cookie-policy line about it is a launch item (HANDOFF). Recently viewed stays device-only and does not feed this.

## Consequences

Counts are approximate (shared NAT merges visitors; a changed IP or browser counts again after 30 minutes). Seeded `viewCount` values stay illustrative and real views add on top.
