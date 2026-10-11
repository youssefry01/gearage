# ADR 0008: Stock model

Status: Accepted
Definitions: `Inventory.onHand` per physical product. `StockReservation(productId, qty, orderId, status ACTIVE|CONVERTED|RELEASED|EXPIRED, expiresAt)`.
Available = onHand - SUM(qty of reservations where status = ACTIVE and expiresAt > now()). There is no stored `reserved` counter, so nothing can drift and no sweeper is needed for correctness.

- **Cash on Delivery:** at order creation, in one transaction, `onHand` is decremented. Cancel/failed delivery restocks via an inventory adjustment.
- **Online payment:** at checkout start, create ACTIVE reservations with a short TTL (aligned with the payment session, about 30 min). On HMAC-verified payment success: convert in one transaction (`onHand -= n`, reservation CONVERTED). On failure/cancel: RELEASED. On timeout: it simply stops counting (EXPIRED by housekeeping).
- **Concurrency:** lock inventory rows in ascending productId (`SELECT ... FOR UPDATE`), check available, then write. Bundle lines are expanded to component demand and aggregated across all cart lines before locking.
- **Late success:** if payment succeeds after the reservation expired, re-acquire stock; if unavailable, mark the order PAID_UNFULFILLABLE and trigger refund + email.
- COD abuse controls: verified email, COD max order value and fee (store settings), limit on open COD orders per user, staff confirmation step before packing.
