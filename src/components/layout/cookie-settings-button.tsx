"use client";

import { useTranslations } from "next-intl";
import { COOKIE_SETTINGS_EVENT } from "@/lib/consent";

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("Footer");
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      {t("cookieSettings")}
    </button>
  );
}
