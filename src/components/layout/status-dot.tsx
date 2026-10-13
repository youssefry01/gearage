"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { parseSystemStatus, type ComponentState } from "@/domain/status";
import { Link } from "@/i18n/navigation";

type View = "loading" | "unavailable" | ComponentState;

const DOT: Record<View, string> = {
  loading: "bg-muted-foreground",
  unavailable: "bg-muted-foreground",
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-danger",
};
const POLL_MS = 5 * 60_000;

/**
 * Compact live status for the footer. Reads the CACHED, coarse /api/status once on load and then every five
 * minutes while the tab is visible (never on a tight loop). Shows a neutral dot until it knows, so there is no
 * layout shift, and "unavailable" if the request fails. Links to the status page.
 */
export function StatusDot() {
  const t = useTranslations("Status");
  const [view, setView] = useState<View>("loading");

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/status", {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        const body: unknown = await res.json();
        const parsed = parseSystemStatus((body as { data?: unknown } | null)?.data);
        if (alive) setView(parsed ? parsed.overall : "unavailable");
      } catch {
        if (alive && !controller.signal.aborted) setView("unavailable");
      }
    }
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  const label =
    view === "loading" ? t("checking") : view === "unavailable" ? t("unavailable") : t(view);

  return (
    <Link
      href={routes.status}
      data-status={view}
      className="rounded-control hover:text-foreground inline-flex min-h-11 items-center gap-2"
    >
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[view]}`} />
      <span role="status">{label}</span>
    </Link>
  );
}
