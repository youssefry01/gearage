# ADR 0004: Paymob behind PaymentProvider

Status: Accepted (re-verify docs at M7)
Decision: Paymob Accept for cards/wallets, behind a provider-agnostic `PaymentProvider` interface. Orders are created server-side; payment status is only trusted from HMAC-verified webhooks (plus server-to-server status query for reconciliation). Idempotent via `PaymentEvent` unique keys. Payment state machine in `domain/`.
Alternatives: Kashier (close second), Fawry (better for pay-at-outlet).
Cost: Live mode needs merchant onboarding and per-transaction fees: the one unavoidable paid item.
