# ADR 0029: The address book (M5b-2c)

Status: accepted. The owner asked for decisions to be listed with a recommendation and for the recommendations to be
built unless one needed their input; none did. Each is **confirm-or-change** (HANDOFF section 16, item 24).
Related: [0013](0013-server-side-structure.md), [0024](0024-auth-flows-and-lockout.md),
[0027](0027-email-change-revert.md), [0028](0028-header-account-menu-and-state.md).

## Context

A signed-in person saves delivery addresses (Egypt). Checkout (M6b) will pick one; shipping zones (M6a) will price by
governorate; orders must never change when an address is edited. Nothing here may let one account see or change
another's addresses, and nothing may reveal whether an address id exists.

## Decisions (with the alternatives that were weighed)

1. **Fields.** Optional label (30), recipient name (80), mobile (E.164), governorate (code), city (60), area (60),
   street (120), building (40), optional floor (20), apartment (20), landmark (120). The brief's list plus a recipient
   name (a courier hands a cash-on-delivery parcel to a named person, often not the account holder) and a label (so ten
   addresses stay tellable apart). No postal code (rarely used in Egypt, and couriers ignore it), no map pin, no
   delivery notes (an order-level field, M6b).
2. **Governorate source: static data, stored as a code.** `src/domain/egypt-governorates.ts`, 27 entries with English
   and Arabic names. Not a table: it changes by decree, every consumer needs it at once, a query adds nothing. The code
   (`kafr-el-sheikh`) is stored, never a name, so renaming a display string never touches data and M6a shipping zones
   key on the same code. The database checks the SHAPE of the code; the application checks membership (a new
   governorate is then one line, not a migration).
3. **City and area: free text.** There is no free, authoritative, maintained list of Egyptian cities and districts at
   the depth couriers use (Nasr City's seventh district, a new compound), and a wrong dropdown is worse than a text
   box. Revisit if a courier integration (M6c) brings its own area list; the columns would stay.
4. **Default address.** Exactly one when there is at least one. The first is the default automatically; a later one is
   only when asked ("use as my default", or the card's "Set as default"). Enforced by a partial unique index
   (`address_user_default_uq`), so the database refuses a second default whatever the code does. Deleting the default
   promotes the most recently updated remaining address (ties: newest created, then id).
5. **Limit: ten per account**, enforced in the service under a lock on the account's row (`SELECT ... FOR UPDATE`), then
   a count. A check-then-insert across rows is a race without it; a test fires 16 creates at once and expects exactly
   ten to succeed and one default. The lock also orders default changes, and only that account's writes wait.
6. **Phone: the same Egyptian mobile rules as the profile**, stored `+20...`, pre-filled from the profile but editable
   per address (the recipient can be someone else). Mobile numbers only for now: a landline delivery contact is rare and
   couriers call mobiles. A CHECK repeats the pattern in the database.
7. **Deletion: a real delete after an inline confirmation.** Orders will hold their own COPY of the address (M6b), so a
   saved address has no dependants, and an address is personal data best removed when asked. No soft delete, no
   "archived" state. The confirmation is inline (not a modal): the safe button ("Keep it") has focus.
8. **No IDOR, no enumeration.** The owner's id comes from the session, never from the client. Every query carries it
   (a structure test greps for lookups by address id alone). An id that is not yours behaves EXACTLY like one that does
   not exist: the same error code, issue and message (a database test compares them for update, set-default and
   delete). Address ids are UUIDv7, but secrecy of the id is not the protection; scoping is.
9. **Rate limiting.** Create, edit, delete and set-default share one budget per account (`auth.address.write.user`, 60
   per hour, fail closed), counted before any work; the `authSession` per-IP policy also applies at the action layer.
   Listing is free (it is a page render behind the session check).
10. **Free text is validated, not sanitized into something else.** Whitespace is collapsed, control characters and line
    breaks are refused, lengths are capped (the same numbers in Zod and in the migration's CHECKs; a database test
    proves they agree). Output is escaped by React; later consumers (emails, the invoice PDF) must escape too.
11. **Inline add/edit on one page**, not separate routes: no second page to lose your place on, fewer URLs to keep in
    the matrices. The form component is standalone so checkout can reuse it.

## Also in this milestone (follow-ups the owner asked for)

- `--header-sticky-h`: the site header measures itself (`HeaderOffset`, `lib/sticky-offset.ts`) and publishes the part
  of it that stays on screen; the account side menu sticks 1rem below it and `scroll-padding-top` follows it. A CSS
  fallback (`8rem`) covers no-JS and the moment before the first measurement.
- Cancel and revert links: see ADR 0027, "Decided (2026-11-17)". A cancel deliberately leaves the undo links of
  earlier completed changes usable, because the cancel link goes to the CURRENT address.

## Consequences

- Data export and account deletion (M8b) must include addresses; deleting the account cascades (tested).
- The privacy policy (M12) states: saved addresses are kept until the person deletes them or the account.
- M6b copies the chosen address into the order; this ADR's `AddressView` and `formatAddressLines` are what it reads.
- Arabic strings are machine-written and on the review list.
