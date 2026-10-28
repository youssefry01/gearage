import { beforeEach, describe, expect, it } from "vitest";
import type { CompareItem } from "@/domain/compare-storage";
import { ensureCompareHydrated, useCompareStore } from "./store";

const state = () => useCompareStore.getState();
const item = (slug: string, group = "cat:components/graphics-cards"): CompareItem => ({
  slug,
  group,
  title: { en: slug, ar: slug },
  image: null,
});

describe("compare store", () => {
  beforeEach(() => {
    localStorage.clear();
    state().clear();
  });

  it("adds, and removes on a second toggle", () => {
    expect(state().toggle(item("a"))).toBe("ok");
    expect(state().items.map((i) => i.slug)).toEqual(["a"]);
    expect(state().toggle(item("a"))).toBe("duplicate");
    expect(state().items).toEqual([]);
  });
  it("refuses a fifth product and says why", () => {
    for (const s of ["a", "b", "c", "d"]) state().toggle(item(s));
    expect(state().toggle(item("e"))).toBe("full");
    expect(state().items).toHaveLength(4);
    expect(state().notice).toEqual({ kind: "full", slug: "e" });
  });
  it("refuses another category and says why", () => {
    state().toggle(item("a"));
    expect(state().toggle(item("x", "cat:components/cpus"))).toBe("mismatch");
    expect(state().items.map((i) => i.slug)).toEqual(["a"]);
    expect(state().notice?.kind).toBe("mismatch");
  });
  it("a successful change clears an old notice; dismiss clears it too", () => {
    state().toggle(item("a"));
    state().toggle(item("x", "cat:other"));
    state().dismissNotice();
    expect(state().notice).toBeNull();
    state().toggle(item("x", "cat:other"));
    state().remove("a");
    expect(state().notice).toBeNull();
  });
  it("removeMany drops several at once", () => {
    for (const s of ["a", "b", "c"]) state().toggle(item(s));
    state().removeMany(["a", "c"]);
    expect(state().items.map((i) => i.slug)).toEqual(["b"]);
  });
  it("persists the items (not the notice) and restores them", async () => {
    state().toggle(item("a"));
    state().toggle(item("x", "cat:other"));
    const raw = localStorage.getItem("compare") ?? "{}";
    const saved = JSON.parse(raw) as { state: Record<string, unknown> };
    expect(Object.keys(saved.state)).toEqual(["items"]);
    // Simulate a fresh page load: the in-memory state is gone, the saved value is still there
    // (setState itself writes storage, so put the saved value back before rehydrating).
    useCompareStore.setState({ items: [], notice: null });
    localStorage.setItem("compare", raw);
    await ensureCompareHydrated();
    expect(state().items.map((i) => i.slug)).toEqual(["a"]);
  });
  it("validates what it reads back: tampered storage cannot inject items", async () => {
    localStorage.setItem(
      "compare",
      JSON.stringify({
        version: 1,
        state: {
          items: [
            {
              slug: "ok",
              group: "g",
              title: { en: "E", ar: "A" },
              image: "https://evil.example/x.png",
            },
            { slug: "<script>", group: "g", title: { en: "E", ar: "A" }, image: null },
            { slug: "other", group: "different", title: { en: "E", ar: "A" }, image: null },
            "junk",
          ],
        },
      }),
    );
    await ensureCompareHydrated();
    expect(state().items).toHaveLength(1);
    expect(state().items[0]?.slug).toBe("ok");
    expect(state().items[0]?.image).toBeNull();
  });
  it("survives unreadable storage", async () => {
    localStorage.setItem("compare", "{not json");
    await expect(ensureCompareHydrated()).resolves.toBeUndefined();
    expect(state().items).toEqual([]);
  });
});
