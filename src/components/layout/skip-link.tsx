import { useTranslations } from "next-intl";

/**
 * First focusable element on every page; jumps keyboard and screen-reader users past the chrome.
 * Visually hidden until focused. Padding applies only while focused so the hidden box stays 1x1.
 */
export function SkipLink() {
  const t = useTranslations("Common");
  return (
    <a
      href="#main"
      className="focus-visible:rounded-control focus-visible:bg-primary focus-visible:text-primary-foreground sr-only font-semibold focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:px-4 focus-visible:py-2"
    >
      {t("skipToContent")}
    </a>
  );
}
