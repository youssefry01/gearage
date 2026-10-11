# ADR 0006: next-intl, locale detection

Status: Accepted
Decision: next-intl with `[locale]` segment, `localePrefix: always` (/en, /ar). First visit to `/` detects `Accept-Language`, falls back to `en`, and remembers the choice in a cookie; later visits use the cookie. The language switcher sets the cookie. Adding a locale = adding `messages/<locale>.json` and one config entry.
SEO: every locale URL is directly indexable; hreflang for en/ar, `x-default` -> en. Crawlers without Accept-Language get `en` at `/`.
Slugs: one Latin slug for both locales. Digits: Western (`ar-EG` with `numberingSystem: latn`).
