"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readStoredTheme } from "@/lib/theme";

/**
 * Re-applies the stored theme whenever the locale layout (re)mounts, e.g. on a locale switch, which rebuilds the
 * <html> element's attributes and would otherwise reset the user's choice. A layout effect runs before paint, so
 * there is no flash. Renders nothing. See lib/theme.ts.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
  }, []);
  return null;
}
