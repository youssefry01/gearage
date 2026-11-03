"use client";

import { useTranslations } from "next-intl";
import { COOKIE_SETTINGS_EVENT } from "@/lib/consent";

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("Footer");
  return (
    <button
      type="button"
      // The component owns its hover state; the caller only adds layout and colour.
      className={`hover:text-foreground ${className ?? ""}`}
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      {t("cookieSettings")}
    </button>
  );
}
