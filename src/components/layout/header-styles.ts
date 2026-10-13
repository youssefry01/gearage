/**
 * Shared look of the icon links in the main header row. 44px minimum target on every size.
 * No display utility on purpose: callers add `inline-flex`, or `hidden sm:inline-flex` to hide at small widths
 * (a baked-in `inline-flex` would beat `hidden` in the generated CSS).
 */
export const headerIconLink =
  "min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2 text-foreground transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground xl:px-3";
