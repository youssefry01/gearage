"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const EVENT = "themechange";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    const next = parseTheme(e.newValue);
    if (next) document.documentElement.setAttribute("data-theme", next);
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = (): ThemePreference =>
  parseTheme(document.documentElement.getAttribute("data-theme")) ?? DEFAULT_THEME;
const getServerSnapshot = (): ThemePreference => DEFAULT_THEME;

function choose(next: ThemePreference) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

const LABEL_KEYS = { light: "themeLight", dark: "themeDark", system: "themeSystem" } as const;

const SIZE = {
  full: "min-h-11 min-w-11",
  // Dense desktop chrome (top bar): 32px with a fine pointer, still 44px on touch screens.
  compact: "min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
} as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Common");
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="group"
      aria-label={t("theme")}
      className="rounded-control border-input inline-flex border p-0.5"
    >
      {THEME_PREFERENCES.map((pref) => (
        <button
          key={pref}
          type="button"
          aria-pressed={current === pref}
          onClick={() => choose(pref)}
          className={`${compact ? SIZE.compact : SIZE.full} text-small duration-fast ease-standard hover:bg-accent hover:text-accent-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-[calc(var(--radius-control)-2px)] px-3 font-medium transition-[background-color,color]`}
        >
          {t(LABEL_KEYS[pref])}
        </button>
      ))}
    </div>
  );
}
