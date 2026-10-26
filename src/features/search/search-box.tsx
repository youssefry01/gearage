"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { productHref } from "@/domain/catalog";
import { formatPrice } from "@/domain/money";
import { cleanQueryInput } from "@/domain/search-normalize";
import type { Locale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routes } from "@/config/routes";
import type { Suggestions } from "@/server/services/search.service";

type Option = {
  key: string;
  group: "products" | "categories" | "brands" | "all";
  href: string;
  label: string;
  detail?: string;
  image?: { url: string; alt: string } | null;
  outOfStock?: boolean;
};

/** The results URL for a term, encoded exactly like a native form submit and like the canonical URL ("+" for spaces). */
const searchHref = (params: Record<string, string>): string =>
  `${routes.search}?${new URLSearchParams(params).toString()}`;

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; query: string; data: Suggestions };

/**
 * The header search box with instant suggestions (ARIA 1.2 combobox with a listbox popup). It is still a real GET
 * form: Enter with nothing highlighted searches, and without JavaScript the plain form shown by the Suspense
 * fallback in header-search.tsx does the same.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const t = useTranslations("Search");
  const nav = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const ids = useId();
  const listId = `${ids}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, Suggestions>());

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [active, setActive] = useState(-1);

  const panelRef = useRef<HTMLDivElement>(null);
  const [panelScrolls, setPanelScrolls] = useState(false);

  const cleaned = cleanQueryInput(value);
  const searchable = cleaned.length >= MIN_CHARS;

  useEffect(() => {
    abortRef.current?.abort();
    if (!searchable) return;
    const hit = cache.current.get(cleaned);
    if (hit) {
      // Served from the session cache: show immediately, no request.
      const timer = setTimeout(() => setState({ kind: "ready", query: cleaned, data: hit }), 0);
      return () => clearTimeout(timer);
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(cleaned)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { ok: boolean; data?: Suggestions };
        if (!res.ok || !body.ok || !body.data) throw new Error("suggest failed");
        cache.current.set(cleaned, body.data);
        setState({ kind: "ready", query: cleaned, data: body.data });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ kind: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cleaned, searchable]);

  const data = searchable && state.kind === "ready" ? state.data : null;
  const options: Option[] = [];
  if (data) {
    for (const p of data.products)
      options.push({
        key: `p-${p.id}`,
        group: "products",
        href: productHref(p.slug),
        label: p.title[locale],
        detail: formatPrice(p.effectivePrice, locale),
        image: p.image ? { url: p.image.url, alt: "" } : null,
        outOfStock: p.available !== null && p.available <= 0,
      });
    for (const c of data.categories)
      options.push({
        key: `c-${c.path}`,
        group: "categories",
        href: `/c/${c.path}`,
        label: c.name[locale],
      });
    for (const b of data.brands)
      options.push({
        key: `b-${b.slug}`,
        group: "brands",
        href: searchHref({ brand: b.slug }),
        label: b.name[locale],
      });
    if (data.total > 0)
      options.push({
        key: "all",
        group: "all",
        href: searchHref({ q: cleaned }),
        label: t("suggestSeeAll", { count: data.total, query: cleaned }),
      });
  }

  const showPanel = open && searchable && state.kind !== "idle";
  const activeIndex = active >= 0 && active < options.length ? active : -1;
  const optionId = (i: number) => `${ids}-opt-${i}`;

  // A scrolling region must be reachable by keyboard (WCAG 2.1.1; axe: scrollable-region-focusable). The panel is a
  // tab stop only while its content really overflows (small screens); the options themselves are chosen with the
  // arrow keys from the input, so focus normally never leaves it.
  useEffect(() => {
    const el = panelRef.current;
    if (!showPanel || !el) return;
    const measure = () => setPanelScrolls(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPanel, state, data]);

  // Keyboard navigation moves a virtual highlight (aria-activedescendant); keep it visible in a scrolling list.
  useEffect(() => {
    if (activeIndex >= 0)
      document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from the stable id prefix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const go = (href: string) => {
    setOpen(false);
    setActive(-1);
    router.push(href);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && options[activeIndex]) return go(options[activeIndex].href);
    go(cleaned ? searchHref({ q: cleaned }) : routes.search);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const n = options.length;
      setActive(
        e.key === "ArrowDown" ? (activeIndex + 1) % n : activeIndex <= 0 ? n - 1 : activeIndex - 1,
      );
    } else if (e.key === "Escape") {
      if (showPanel) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  let status = "";
  if (showPanel) {
    if (state.kind === "loading") status = t("suggestLoading");
    else if (state.kind === "error") status = t("suggestError");
    else status = t("suggestStatus", { count: options.filter((o) => o.group !== "all").length });
  }

  const groups: { id: Option["group"]; title: string }[] = [
    { id: "products", title: t("suggestProducts") },
    { id: "categories", title: t("suggestCategories") },
    { id: "brands", title: t("suggestBrands") },
  ];

  return (
    <form
      role="search"
      action={`/${locale}${routes.search}`}
      method="get"
      onSubmit={submit}
      onBlur={(e: FocusEvent<HTMLFormElement>) => {
        // Close when focus leaves the whole search (input, button and list), not when it moves within it.
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
      className={`relative ${className}`}
    >
      <Suspense fallback={null}>
        <UrlQuerySync onQuery={setValue} />
      </Suspense>
      <label htmlFor="site-search" className="sr-only">
        {nav("searchLabel")}
      </label>
      <input
        ref={inputRef}
        id="site-search"
        name="q"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={120}
        value={value}
        placeholder={nav("searchPlaceholder")}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="rounded-control border-input bg-card text-foreground placeholder:text-muted-foreground min-h-11 w-full border ps-4 pe-12"
      />
      <button
        type="submit"
        aria-label={nav("searchSubmit")}
        className="rounded-e-control text-muted-foreground duration-fast hover:text-foreground absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center transition-colors"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>

      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>

      {showPanel ? (
        <div
          // Keep focus in the input while the pointer is used inside the panel.
          onMouseDown={(e) => e.preventDefault()}
          ref={panelRef}
          {...(panelScrolls ? { tabIndex: 0, role: "group", "aria-label": t("suggestLabel") } : {})}
          className="border-border bg-popover text-popover-foreground rounded-panel absolute inset-x-0 top-full z-50 mt-1 max-h-[70dvh] overflow-y-auto overscroll-contain border shadow-lg"
        >
          <ul id={listId} role="listbox" aria-label={t("suggestLabel")} className="py-1">
            {state.kind === "loading" ? (
              <li role="presentation" className="text-muted-foreground px-4 py-3">
                {t("suggestLoading")}
              </li>
            ) : null}
            {state.kind === "error" ? (
              <li role="presentation" className="text-muted-foreground px-4 py-3">
                {t("suggestError")}
              </li>
            ) : null}
            {data && options.length === 0 ? (
              <li role="presentation" className="text-muted-foreground px-4 py-3">
                {t("suggestNone")}
              </li>
            ) : null}
            {data?.corrected ? (
              <li role="presentation" className="text-small text-muted-foreground px-4 py-2">
                {t("suggestCorrected", { corrected: data.corrected })}
              </li>
            ) : null}
            {groups.map((g) => {
              const rows = options.filter((o) => o.group === g.id);
              if (rows.length === 0) return null;
              return (
                <li key={g.id} role="presentation">
                  <div
                    role="presentation"
                    className="text-small text-muted-foreground px-4 pt-2 pb-1 font-semibold"
                  >
                    {g.title}
                  </div>
                  <ul role="presentation">
                    {rows.map((o) => {
                      const i = options.indexOf(o);
                      return (
                        <Row
                          key={o.key}
                          option={o}
                          id={optionId(i)}
                          selected={i === activeIndex}
                          outOfStock={t("outOfStock")}
                          onChoose={() => go(o.href)}
                          onHover={() => setActive(i)}
                        />
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {options.some((o) => o.group === "all")
              ? options
                  .filter((o) => o.group === "all")
                  .map((o) => {
                    const i = options.indexOf(o);
                    return (
                      <Row
                        key={o.key}
                        option={o}
                        id={optionId(i)}
                        selected={i === activeIndex}
                        outOfStock={t("outOfStock")}
                        onChoose={() => go(o.href)}
                        onHover={() => setActive(i)}
                        emphasized
                      />
                    );
                  })
              : null}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function Row({
  option,
  id,
  selected,
  outOfStock,
  onChoose,
  onHover,
  emphasized = false,
}: {
  option: Option;
  id: string;
  selected: boolean;
  outOfStock: string;
  onChoose: () => void;
  onHover: () => void;
  emphasized?: boolean;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onClick={onChoose}
      onMouseMove={onHover}
      className={`flex min-h-11 cursor-pointer items-center gap-3 px-4 py-1.5 ${selected ? "bg-accent text-accent-foreground" : ""} ${emphasized ? "border-border border-t font-semibold" : ""}`}
    >
      {option.group === "products" ? (
        <span className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-[0.375rem]">
          {option.image ? (
            <Image
              src={option.image.url}
              alt=""
              fill
              sizes="40px"
              unoptimized={option.image.url.endsWith(".svg")}
              className="object-contain p-0.5"
            />
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words">{option.label}</span>
        {option.outOfStock ? (
          <span className="text-small text-muted-foreground block">{outOfStock}</span>
        ) : null}
      </span>
      {option.detail ? (
        <span className="text-small shrink-0 font-semibold tabular-nums">{option.detail}</span>
      ) : null}
    </li>
  );
}

/**
 * Fills the box with the current search while on the results page, and clears it elsewhere. It lives in its own
 * Suspense boundary (reading the URL's query string opts a component out of static rendering) and renders nothing,
 * so the search box itself is in the server HTML and hydrates in place: nothing is swapped, and what a shopper
 * types before the script loads is not thrown away by a re-mount.
 */
function UrlQuerySync({ onQuery }: { onQuery: (q: string) => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === routes.search ? (params.get("q") ?? "") : "";
  useEffect(() => {
    onQuery(urlQuery);
  }, [urlQuery, onQuery]);
  return null;
}
