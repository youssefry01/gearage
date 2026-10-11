# ADR 0010: PC bundles

Status: Accepted (open decisions in HANDOFF section 10)

- Bundle = `Product.type = BUNDLE` + `BundleItem(bundleId, componentProductId, quantity, swappable, sortOrder)`. Components must be physical (no nesting); deleting a referenced component is restricted; archiving one makes the bundle unavailable.
- Pricing modes: FIXED, DISCOUNT_PERCENT, DISCOUNT_FIXED. "You save" is recomputed from current component prices; hidden when <= 0 and flagged for admin review.
- Stock is derived (min over floor((available)/qty)) in SQL view `product_availability`; listings use it without N+1.
- Orders snapshot the bundle line and `OrderItemComponent` rows (SKU, title, qty, allocated price, VAT, promo share, unit cost, warranty). Allocation is proportional to list price with largest-remainder rounding so parts sum exactly.
- Returns reference components; a returned GPU restocks the GPU.
- Compatibility rules live in pure `domain/compatibility` and a test asserts every seeded bundle passes.
