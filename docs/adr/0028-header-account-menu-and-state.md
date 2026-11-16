# ADR 0028: The header account menu, and how the header learns who is signed in (M5b-2b)

Status: accepted (owner approved the account area layout and order on 2026-11-14).
Related: [0013](0013-server-side-structure.md), [0016](0016-listing-urls-seo-and-caching.md), [0024](0024-auth-flows-and-lockout.md).

## Context

The owner wants a header account control that shows the signed-in state (name or initial, My account, Sign out) and a
tidier account area. The header sits in the layout of every page. Those pages are static or ISR (ADR 0016) and must
stay so: reading the session cookie in the layout, or in any server component of the header, makes every page dynamic
(no CDN cache, no ISR, a function run per page view).

## Decisions

1. **The page stays static; the browser asks.** `GET /api/account/state` returns `{signedIn:false}` or `{signedIn:true,
name, initial}` (first name and its first character; no email, no id). `Cache-Control: private, no-store`, `Vary: Cookie`.
   A request with no session cookie is answered without the rate limiter or the database; one with a cookie costs a limiter
   hit (`account.state`, 120 per minute per IP, fail open) and the normal session lookup. Cost: one small function run per
   page load. If that count ever matters on the hosting plan, a readable "signed-in hint" cookie can let anonymous
   visitors skip the request; it was not built because every session-creating path would have to set it.
2. **A store with three states.** `unknown` (before the first answer, or after failed checks), `signed-out`, `signed-in`
   (Zustand, not persisted). While `unknown` the header shows a plain link to `/account`, which works for both kinds of
   visitor (a signed-out one is sent to sign-in and returned), so the page never depends on JavaScript or on the answer.
   A failed check keeps the previous state: a rate limit or an outage says nothing about the session.
3. **When it asks again.** On load; when leaving a sign-in or account page (a session started, ended, or the name changed);
   when entering an account page while not known to be signed in; when the tab becomes visible after a minute; when a page
   is restored from the back/forward cache; and after a profile save and a sign-out. Overlapping asks are merged and the
   last one wins.
4. **Sign-out proves itself.** `useSignOut` awaits the Server Action, asks the server who is signed in, and navigates home
   only if nobody is. The URL reaching the home page is therefore proof the session is gone, which the e2e helper
   `signOut()` relies on (navigating away while the action is in flight cancels it: the cause of the flaky "next
   parameter" test, which was a race in the test, not in the app).
5. **A disclosure, not a menu.** Same pattern as the mega-menu: `<button aria-expanded aria-controls>` revealing a panel of
   ordinary links; no `role="menu"`, no focus trap; Escape closes and returns focus; click outside, focus leaving, and
   navigation close it. It opens on click or key only (no hover): a Sign out button inside a hover panel is too easy to hit
   by accident. A move of focus to nowhere (Safari does not focus buttons on click) does not close it. The panel is shifted
   by a measured amount so it stays inside the viewport in both directions at any width.
6. **Contents.** Signed in: My account, Profile, Security, Sign out. Signed out: Sign in, Create account. Only sections
   that exist are listed; the list comes from `src/config/account-sections.ts`, shared with the account pages' own menu,
   so Addresses (M5b-2c), Orders (M6b) and Wishlist (M8a) are added in one place.
7. **Account pages.** One shell: a column beside the content from `lg`, a wrapping row of 44px links above it below `lg`
   with Sign out last (wrapping rather than scrolling, so Sign out is never hidden at 320px). Overview is a summary (who
   is signed in, device count) and does not repeat profile fields; Profile is one form with one Save (email read-only with a
   pointer); Security holds Password, Email (with a Change button to `/account/email`, which stays its own page and is
   highlighted under Security), Devices and Activity.

## Consequences

- Signed-in visitors see the plain account link for a moment before the button appears (same size and position).
- `/api/account/state` is a new public endpoint: covered by a unit test of its cookie check, the store's tests, and e2e.
- Per-user data never enters a cached page; the header's personal part is client-side only.
