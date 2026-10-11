# ADR 0012: Design tokens, theming, brand config, responsive matrix

Status: Accepted (2026-10-11)

## Decisions

- **Colors have one source**: `src/design/tokens.ts` (typed, both themes). `src/styles/tokens.css` is GENERATED (`npm run tokens:build`); CI fails on drift (`tokens:check`). Components use semantic classes (`bg-background`, `text-link`), never hex. Names follow shadcn/ui so its components drop in later.
- **Contrast is a CI gate**: `CONTRAST_PAIRS` lists every foreground/background promise; `npm run contrast` and a unit test fail below WCAG AA (text 4.5, UI/large 3) in either theme. A negative test proves the gate can fail.
- **Orange rule**: bright `#F56514` is for fills with a dark label (6.1:1) and focus rings on dark. Orange text/links on light use `#C2410C` (5.2:1) because brand orange on white is 3.1:1.
- **Themes**: dark is brand-native and the default. `data-theme` = `dark | light | system` on `<html>`; preference in `localStorage`, applied before first paint by a constant inline script (so pages stay statically rendered; a strict CSP can allow it by hash). `system` follows `prefers-color-scheme`. No cookie is read on the server, which keeps `/en` and `/ar` static.
- **Fonts**: IBM Plex Sans (Latin) and IBM Plex Sans Arabic via `@fontsource`, self-hosted, no Google requests (asserted by an e2e test). Arabic leads on `:lang(ar)`, with no letter-spacing (it breaks joining) and larger leading.
- **i18n**: next-intl, `localePrefix: always`, Next 16 `proxy.ts`, locale from `next/root-params`, typed messages. Adding a locale = `messages/<l>.json` + one entry in `src/i18n/locales.ts`; a test enforces parity (same keys, same placeholders, no empties). Western digits (`numberingSystem: latn`).
- **Brand config**: `src/config/brand.ts` (name per locale with English fallback, tagline, SEO text, logo and OG paths, dimensions verified against files by a test). Messages use `{brand}`/`{tagline}`. `npm run brand:check` fails on the name anywhere else in src, tests, scripts, prisma or public.
- **Metadata**: pages return `pageMetadata(locale, ...)` (canonical, hreflang, FULL Open Graph incl. image). Next replaces nested metadata objects instead of merging, so partial `openGraph` objects are a bug.
- **Responsive matrix** (`tests/e2e/viewports.ts`): 10 viewports from 320x568 to 3440x1440 in LTR and RTL; asserts no horizontal scroll and 44px targets. axe (WCAG 2.2 AA) runs in both themes.

## Consequences

- Unit tests cannot see CSS: the logo-swap and metadata bugs of M1a were found only by the real-browser suite. Keep e2e in CI.
- `typedRoutes` is off (conflicts with locale-prefixed hrefs).
