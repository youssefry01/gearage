import { beforeEach, describe, expect, it } from "vitest";
import { RECENT_MAX } from "@/domain/recently-viewed";
import { ensureRecentHydrated } from "./hydrate";
import { useRecentStore } from "./store";

const state = () => useRecentStore.getState();

describe("recently viewed store", () => {
  beforeEach(() => {
    localStorage.clear();
    state().clear();
  });

  it("records newest first without duplicates and caps the list", () => {
    for (let i = 0; i < RECENT_MAX + 5; i++) state().record(`p-${i}`);
    state().record("p-10");
    expect(state().slugs).toHaveLength(RECENT_MAX);
    expect(state().slugs[0]).toBe("p-10");
    expect(new Set(state().slugs).size).toBe(RECENT_MAX);
  });
  it("removeMany and clear", () => {
    state().record("a");
    state().record("b");
    state().removeMany(["a"]);
    expect(state().slugs).toEqual(["b"]);
    state().clear();
    expect(state().slugs).toEqual([]);
    expect(JSON.parse(localStorage.getItem("recently-viewed") ?? "{}").state.slugs).toEqual([]);
  });
  it("restores from storage and validates it", async () => {
    localStorage.setItem(
      "recently-viewed",
      JSON.stringify({
        version: 1,
        state: { slugs: ["good", "Bad Slug", 7, "good", "also-good"] },
      }),
    );
    await ensureRecentHydrated();
    expect(state().slugs).toEqual(["good", "also-good"]);
  });
});
