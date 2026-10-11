/** Theme preference handling shared by the pre-paint script, the toggle and tests. Dark is the brand-native default. */
export const THEME_STORAGE_KEY = "theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseTheme(value: unknown): ThemePreference | null {
  return THEME_PREFERENCES.find((t) => t === value) ?? null;
}

/**
 * Runs in <head> before first paint so a saved light/system preference never flashes dark.
 * The content is a constant, so a strict CSP can allow it by hash instead of a nonce (and pages stay static).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"||t==="system"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
