# M5b-2c changelog (address book, plus the header-height variable and the cancel/undo answer)

No new dependencies (`package.json` and the lockfile are unchanged). **One migration, hand-written (the Prisma schema
engine cannot be downloaded in my sandbox): `20261117000000_address_book`. Please run the drift check below.**

- **Address book** (ADR 0029): `/account/addresses` inside the account shell and in the header menu, with a card on the
  overview. Add, edit, set default, delete (inline confirmation). Fields: label, recipient, mobile, governorate (27, static
  data, stored as a code), city, area, street, building, floor, apartment, landmark. Up to 10 per account, exactly one
  default, the first is the default. English and Arabic (RTL).
- **Follow-up (a):** the header publishes `--header-sticky-h` (its measured, stuck height); the account side menu and
  `scroll-padding-top` use it instead of the fixed `lg:top-36`. Unit tests for the measurement and an e2e test that the menu
  sits 1rem below the real header at 1024, 1280 and 1440px and that the variable follows a resize.
- **Follow-up (b), the answer:** a cancel did NOT deliberately leave undo links usable (the ADR was silent), but it should:
  the cancel link is sent to the CURRENT address, which after a completed change is the NEW one. If cancel deleted the undo
  rows, whoever holds the new address could start a second change and press that cancel link to destroy the owner's only way
  back. So I kept the behaviour, wrote it into ADR 0027 and pinned it with a database test. **This is the opposite of what you
  asked for ("if not, delete them"); the reason is above. Say so if you still want it changed.**
- Tests: 20 unit (831 total), 18 database (451), 35 e2e (929): addresses.spec.ts 10, the sticky test 1, the a11y and
  responsive matrices for the new page 24.
- Docs: ADR 0029, ADR 0027 "Decided (2026-11-17)", `docs/AUTH_MANUAL_TESTS.md` section 19, HANDOFF (status, section 11h, issues
  119 to 125, owner question 24, the two test lessons in section 9), `docs/I18N_REVIEW.md` regenerated.

## Run it

```
npm ci
npx prisma migrate dev
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code   # 0 = no drift
npm run lint && npm run typecheck && npm test && npm run test:db
env -u DATABASE_URL npm run build      # PowerShell: Remove-Item Env:DATABASE_URL; npm run build
npm run build && E2E_PROD=1 npm run test:e2e
```

Then section 19 of `docs/AUTH_MANUAL_TESTS.md`.
