import { describe, expect, it } from "vitest";
import {
  RECENT_MAX,
  RECENT_SHOWN,
  parseStoredRecent,
  pushRecent,
  shelfSlugs,
} from "./recently-viewed";

describe("pushRecent", () => {
  it("puts the newest first and moves repeats instead of duplicating", () => {
    expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(pushRecent(["a"], "b")).toEqual(["b", "a"]);
  });
  it("caps the list", () => {
    const many = Array.from({ length: RECENT_MAX }, (_, i) => `p-${i}`);
    const out = pushRecent(many, "new");
    expect(out).toHaveLength(RECENT_MAX);
    expect(out[0]).toBe("new");
    expect(out).not.toContain(`p-${RECENT_MAX - 1}`);
  });
  it("ignores an invalid slug", () => {
    expect(pushRecent(["a"], "Not A Slug")).toEqual(["a"]);
  });
});

describe("parseStoredRecent", () => {
  it("keeps valid unique slugs in order", () => {
    expect(parseStoredRecent(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
  it("survives garbage", () => {
    expect(parseStoredRecent(null)).toEqual([]);
    expect(parseStoredRecent({ 0: "a" })).toEqual([]);
    expect(parseStoredRecent([1, null, "<script>", "ok", { x: 1 }])).toEqual(["ok"]);
  });
  it("caps what it accepts", () => {
    const many = Array.from({ length: 50 }, (_, i) => `p-${i}`);
    expect(parseStoredRecent(many)).toHaveLength(RECENT_MAX);
  });
});

describe("shelfSlugs", () => {
  it("leaves out the current product and caps the shelf", () => {
    const list = Array.from({ length: RECENT_MAX }, (_, i) => `p-${i}`);
    const out = shelfSlugs(list, "p-0");
    expect(out).not.toContain("p-0");
    expect(out).toHaveLength(RECENT_SHOWN);
    expect(out[0]).toBe("p-1");
  });
});
