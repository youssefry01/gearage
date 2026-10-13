"use client";

import { themeInitScript } from "@/lib/theme";

/**
 * Applies the saved theme before first paint.
 *
 * Why a client component that renders only on the server: React 19 logs "Encountered a script tag while
 * rendering React component" whenever a <script> element is CREATED during client rendering. Switching locale
 * remounts the locale layout on the client, so a script rendered from a server component (whose output is
 * re-sent in the RSC payload) triggers it on every switch. Here the script is emitted in the server-rendered
 * HTML (SSR of this client component) and skipped on every client render. React 19 tolerates the unmatched
 * node in <head> during hydration, and the script has already run by then.
 */
export function ThemeScript() {
  if (typeof window !== "undefined") return null;
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
