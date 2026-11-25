/**
 * How much of the sticky site header stays on screen while the page scrolls (M5b-2c). The header's height depends on
 * its content (the search row wraps on a phone, the category row appears from lg) and its top bar scrolls away on
 * purpose (`top` is negative there), so no constant is right everywhere. The header measures itself and publishes
 * the result as the CSS variable `--header-sticky-h`; everything that sticks BELOW the header (the account side menu,
 * the scroll padding for in-page links) is positioned from the variable and cannot drift from the real header.
 */
export const HEADER_STICKY_VAR = "--header-sticky-h";

/**
 * Visible height of a sticky header that is stuck: its full height plus its (negative) `top`. A header that is not
 * sticky (short landscape phones) occupies no screen while scrolling, so 0.
 */
export function stuckHeaderHeight(m: { position: string; height: number; top: number }): number {
  if (m.position !== "sticky") return 0;
  const top = Number.isFinite(m.top) ? m.top : 0;
  return Math.max(0, Math.round(m.height + Math.min(0, top)));
}
