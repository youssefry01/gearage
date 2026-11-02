# ADR 0022: Transactional email through Brevo, with an outbox

Status: Accepted (M5a-1)

## Decisions

- **Provider interface** (`EmailProvider.send` returns `{ok, messageId}` or `{ok:false, retryable, reason}`, never throws for expected failures). Implementations: **Brevo** over plain `fetch` to `https://api.brevo.com/v3/smtp/email` with the `api-key` header (no SDK: one fewer dependency; the response is validated with Zod) and **log** (writes `<time>-<id>.json` and `.html` to `EMAIL_LOG_DIR` and prints the plain text in the server log; nothing is sent).
- **Selection:** `EMAIL_PROVIDER`, else Brevo when `BREVO_API_KEY` is set, else log. **Test mode always means log**, whatever `.env` holds. Production (`VERCEL_ENV=production`) refuses log.
- **Sender:** `EMAIL_FROM` (required for Brevo; must be a verified Brevo sender), `EMAIL_FROM_NAME` (default: store name from the brand config), `EMAIL_REPLY_TO` (optional). **Launch blocker:** authenticate our own domain in Brevo (DKIM and DMARC) and send from it; a free Gmail sender will be rewritten or land in spam.
- **Error text** kept from Brevo is only the HTTP status and its short code; never the key, recipient or body. 429, 5xx and network errors are retryable; other 4xx are not.
- **Outbox** (`email_outbox`): `enqueueEmail` inserts a row, in the caller's transaction when one is passed, so an email exists if and only if the change committed. It never sends, so a request's speed and answer cannot depend on whether an address exists (no enumeration). `dispatchEmail(id)` sends one row right after commit; a job (`dispatch-email-outbox`, every tick) retries rows with backoff 1 min, 5 min, 30 min, 2 h and gives up after five attempts. Rows are claimed with `FOR UPDATE SKIP LOCKED` and a 120 s lease (a crashed worker's row is picked up again), so the same row is never sent twice concurrently. A crash after Brevo accepts but before the row is marked SENT could send twice: at-least-once, accepted for codes and reset links.
- **Secrets in the outbox:** the payload holds the code or link. It is **cleared to `{}`** when the row is SENT, FAILED or EXPIRED (a CHECK constraint refuses anything else), and a message is never sent after its code or link expired. Rows are deleted after 7 days.
- **Templates:** plain TypeScript producing table-based HTML plus plain text (`src/server/email/render.ts`), not React Email: no `react-dom/server` in the server bundle, trivial to test. Text comes from the `Email` messages (brand name interpolated), loaded like the app's messages so a new locale needs only its message file. Arabic is right-to-left with the code forced left-to-right. Colors are inlined from the design tokens (email clients have no CSS variables). Every value is escaped. Templates now: `verify-code`, `reset-password`, `test`.

## Consequences

Brevo's free plan has a daily send cap (about 300). The jobs only run when the cron workflow is activated (HANDOFF section 14); until then retries need the cron endpoint called by hand.
