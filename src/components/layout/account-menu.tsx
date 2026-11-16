"use client";

import { ChevronDown, User } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ACCOUNT_SECTIONS } from "@/config/account-sections";
import { routes } from "@/config/routes";
import { isAuthArea } from "@/domain/account-state";
import { useAccountStateStore } from "@/features/account/account-state-store";
import { useSignOut } from "@/features/auth/use-sign-out";
import { Link, usePathname } from "@/i18n/navigation";
import { headerIconLink } from "./header-styles";

const item =
  "rounded-control flex min-h-11 w-full items-center px-3 text-start text-small font-medium text-foreground transition-colors duration-fast ease-standard hover:bg-accent hover:text-accent-foreground";
const RECHECK_AFTER_MS = 60_000;

/**
 * The account entry of the header (M5b-2b, ADR 0028). The page itself is static, so who is signed in is asked from
 * /api/account/state after load; until the answer arrives, and whenever it cannot be had, this is a plain link to
 * /account (which sends a signed-out visitor to sign-in and returns them), exactly what the header had before.
 *
 * Once known it is a disclosure button with the same pattern as the mega-menu (WAI-ARIA disclosure navigation): a
 * <button aria-expanded> that reveals a panel of ordinary links, no menu roles, no focus trap. Enter, Space or a click
 * opens it; Escape closes it and returns focus to the button; a click outside, focus moving out, or navigating closes
 * it; Tab moves from the button into the panel because the panel is the next element. Unlike the mega-menu it does not
 * open on hover (a sign-out button in a hover panel is too easy to trigger by accident).
 * Signed in: the first-name initial, and My account / Profile / Security / Sign out. Signed out: Sign in and Create account.
 */
export function AccountMenu() {
  const t = useTranslations("Nav");
  const tn = useTranslations("Account.nav");
  const status = useAccountStateStore((s) => s.status);
  const name = useAccountStateStore((s) => s.name);
  const initial = useAccountStateStore((s) => s.initial);
  const refresh = useAccountStateStore((s) => s.refresh);
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastCheck = useRef(0);
  const lastPath = useRef(pathname);
  const { signOut, busy, failed } = useSignOut();

  // Close after navigating or when the answer about the visitor changes (adjust state during render, not in an effect).
  const [lastSeen, setLastSeen] = useState({ pathname, status });
  if (lastSeen.pathname !== pathname || lastSeen.status !== status) {
    setLastSeen({ pathname, status });
    setOpen(false);
  }

  // Ask once on load, and again when the tab comes back after a while or is restored from the back/forward cache.
  useEffect(() => {
    lastCheck.current = Date.now();
    void refresh();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck.current < RECHECK_AFTER_MS) return;
      lastCheck.current = Date.now();
      void refresh();
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onShow);
    };
  }, [refresh]);

  // A session starts or ends on the sign-in pages and changes on the account pages: ask again when leaving one of them.
  useEffect(() => {
    const previous = lastPath.current;
    lastPath.current = pathname;
    if (previous === pathname) return;
    if (isAuthArea(previous) || (isAuthArea(pathname) && status !== "signed-in")) {
      lastCheck.current = Date.now();
      void refresh();
    }
  }, [pathname, status, refresh]);

  // A click or tap outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the panel inside the viewport whatever the width or direction (at 320px the button is not near the edge).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const place = () => {
      panel.style.translate = "0 0";
      const rect = panel.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const margin = 8;
      let dx = 0;
      if (rect.left < margin) dx = margin - rect.left;
      else if (rect.right > viewport - margin) dx = viewport - margin - rect.right;
      panel.style.translate = `${dx}px 0`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, status]);

  if (status === "unknown") {
    return (
      <Link href={routes.account} className={`${headerIconLink} inline-flex`}>
        <User aria-hidden="true" className="size-6" />
        <span className="sr-only xl:not-sr-only xl:flex xl:flex-col xl:text-start xl:leading-tight">
          <span className="text-muted-foreground text-xs">{t("signIn")}</span>
          <span className="text-small font-semibold">{t("account")}</span>
        </span>
      </Link>
    );
  }

  const signedIn = status === "signed-in";
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Only a move of focus to somewhere else on the page closes it; a click on a control in Safari moves no focus.
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`${headerIconLink} hover:bg-accent inline-flex`}
        data-testid="account-menu-trigger"
      >
        {signedIn ? (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground text-small grid size-7 place-items-center rounded-full font-bold"
          >
            {initial}
          </span>
        ) : (
          <User aria-hidden="true" className="size-6" />
        )}
        <span className="sr-only xl:not-sr-only xl:flex xl:flex-col xl:text-start xl:leading-tight">
          <span className="text-muted-foreground max-w-32 truncate text-xs">
            {signedIn ? t("greeting", { name }) : t("signIn")}
          </span>
          <span className="text-small font-semibold">{t("account")}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="duration-fast hidden size-4 transition-transform aria-expanded:rotate-180 motion-reduce:transition-none xl:block"
        />
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          data-testid="account-menu-panel"
          className="border-border bg-popover text-popover-foreground rounded-panel motion-safe:animate-mega-in absolute end-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] border p-2 shadow-lg"
        >
          {signedIn ? (
            <>
              <p className="text-small text-muted-foreground truncate px-3 py-2">
                {t("signedInAs", { name })}
              </p>
              <ul>
                {ACCOUNT_SECTIONS.map((section) => (
                  <li key={section.key}>
                    <Link href={section.href} className={item}>
                      {section.key === "overview" ? t("myAccount") : tn(section.key)}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-border mt-1 border-t pt-1">
                <button
                  type="button"
                  disabled={busy}
                  className={item}
                  data-testid="account-menu-signout"
                  onClick={async () => {
                    await signOut();
                    triggerRef.current?.focus();
                  }}
                >
                  {busy ? t("signingOut") : t("signOut")}
                </button>
                {failed ? (
                  <p role="alert" className="text-danger text-small px-3 py-2">
                    {t("signOutFailed")}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>
                <Link href={routes.login} className={item}>
                  {t("signIn")}
                </Link>
              </li>
              <li>
                <Link href={routes.register} className={item}>
                  {t("createAccount")}
                </Link>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
