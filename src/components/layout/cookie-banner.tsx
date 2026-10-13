"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { routes } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import {
  CONSENT_CHANGE_EVENT,
  COOKIE_SETTINGS_EVENT,
  consentCookieString,
  makeConsent,
  readConsent,
} from "@/lib/consent";
import { Button } from "@/components/ui/button";

const subscribe = (cb: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, cb);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, cb);
};
const getSnapshot = (): string | null => document.cookie;
// null on the server and during hydration: render nothing until the cookie can be read, so there is no mismatch.
const getServerSnapshot = (): string | null => null;

/**
 * Consent banner (PDPL-style: informed, specific, recorded). Non-modal: it never blocks the page or steals focus
 * on first load. "Accept all" and "Reject non-essential" are equal-weight buttons (no dark patterns); essential
 * storage is always on, analytics is off until allowed. The footer's "Cookie settings" reopens it.
 */
export function CookieBanner() {
  const t = useTranslations("Cookies");
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const existing = raw === null ? null : readConsent(raw);
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const open = () => {
      setAnalytics(readConsent(document.cookie)?.analytics ?? false);
      setDetails(true);
      setReopened(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (reopened) heading.current?.focus(); // the visitor asked for it, so moving focus here is expected
  }, [reopened]);

  if (raw === null || (existing && !reopened)) return null;

  function save(allowAnalytics: boolean) {
    document.cookie = consentCookieString(
      makeConsent(allowAnalytics),
      window.location.protocol === "https:",
    );
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    setReopened(false);
    setDetails(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-title"
        className="rounded-panel border-border bg-popover text-popover-foreground mx-auto max-w-3xl border p-4 shadow-xl sm:p-5"
      >
        <h2
          id="cookie-title"
          ref={heading}
          tabIndex={-1}
          className="text-heading font-semibold focus:outline-none"
        >
          {t("title")}
        </h2>
        <p className="text-small text-muted-foreground mt-1">
          {t.rich("body", {
            link: (chunks) => (
              <Link
                href={routes.cookies}
                className="text-link hover:text-link-hover underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>

        {details ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-control border-border flex items-start justify-between gap-4 border p-3">
              <div>
                <p className="font-medium">{t("essentialTitle")}</p>
                <p className="text-small text-muted-foreground">{t("essentialDesc")}</p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                aria-label={t("essentialTitle")}
                className="accent-primary mt-1 size-5"
              />
            </div>
            <label className="rounded-control border-border flex min-h-11 cursor-pointer items-start justify-between gap-4 border p-3">
              <span>
                <span className="block font-medium">{t("analyticsTitle")}</span>
                <span className="text-small text-muted-foreground block">{t("analyticsDesc")}</span>
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="accent-primary mt-1 size-5"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {details ? (
            <Button onClick={() => save(analytics)}>{t("save")}</Button>
          ) : (
            <>
              <Button onClick={() => save(true)}>{t("acceptAll")}</Button>
              <Button variant="secondary" onClick={() => save(false)}>
                {t("reject")}
              </Button>
              <Button variant="ghost" onClick={() => setDetails(true)}>
                {t("customize")}
              </Button>
            </>
          )}
          {reopened ? (
            <Button variant="ghost" onClick={() => setReopened(false)}>
              {t("close")}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
