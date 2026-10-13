/** Theme preference handling shared by the pre-paint script, the toggle and tests. Dark is the brand-native default. */
export const THEME_STORAGE_KEY = "theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseTheme(value: unknown): ThemePreference | null {
  return THEME_PREFERENCES.find((t) => t === value) ?? null;
}

/** The stored preference, or the default. Never throws (storage can be blocked). */
export function readStoredTheme(storage: Pick<Storage, "getItem"> = localStorage): ThemePreference {
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Writes the theme to <html>. The ThemeSync component calls this whenever the locale layout (re)mounts. */
export function applyTheme(
  pref: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute("data-theme", pref);
}

/**
 * Runs in <head> before first paint so a saved light/system preference never flashes dark.
 * `data-theme` is NOT a React prop on <html> and cannot be treated as persistent DOM state either: when the locale
 * layout remounts on a locale switch, React rebuilds <html>'s attributes and drops it. So this script covers the
 * first paint and <ThemeSync/> re-applies the stored theme in a layout effect (before paint) on every (re)mount.
 * It always sets the attribute (stored value, else the default); without JS the CSS default (dark) applies.
 * The content is a constant, so a strict CSP can allow it by hash instead of a nonce (and pages stay static).
 */
export const themeInitScript = `(function(){var d=document.documentElement,v=${JSON.stringify(DEFAULT_THEME)};try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"||t==="system")v=t}catch(e){}d.setAttribute("data-theme",v)})();`;
