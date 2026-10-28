import { describe, expect, it } from "vitest";
import { isSafeImagePath, parseStoredCompare } from "./compare-storage";

const item = (slug: string, group = "cat:x", image: unknown = "/uploads/a.svg") => ({
  slug,
  group,
  title: { en: slug, ar: slug },
  image,
});

describe("parseStoredCompare", () => {
  it("keeps well-formed items", () => {
    expect(parseStoredCompare([item("a"), item("b")]).map((i) => i.slug)).toEqual(["a", "b"]);
  });
  it("survives garbage without throwing", () => {
    expect(parseStoredCompare("x")).toEqual([]);
    expect(parseStoredCompare([null, 1, "a", {}, { slug: "a" }])).toEqual([]);
  });
  it("drops duplicates, invalid slugs and a second group", () => {
    const out = parseStoredCompare([
      item("a"),
      item("a"),
      item("Bad Slug"),
      item("c", "cat:other"),
      item("d"),
    ]);
    expect(out.map((i) => i.slug)).toEqual(["a", "d"]);
  });
  it("caps at four", () => {
    const out = parseStoredCompare(["a", "b", "c", "d", "e"].map((s) => item(s)));
    expect(out).toHaveLength(4);
  });
  it("nulls an unsafe image instead of keeping it", () => {
    expect(
      parseStoredCompare([item("a", "cat:x", "https://evil.example/x.png")])[0]?.image,
    ).toBeNull();
    expect(parseStoredCompare([item("a", "cat:x", "javascript:alert(1)")])[0]?.image).toBeNull();
  });
});

describe("isSafeImagePath", () => {
  it("accepts own-origin paths only", () => {
    expect(isSafeImagePath("/uploads/seed/a.svg")).toBe(true);
    for (const bad of [
      "//evil.com/a.png",
      "https://x/a.png",
      "/a/../b",
      "a.png",
      "/a\\b",
      "",
      5,
      null,
    ])
      expect(isSafeImagePath(bad)).toBe(false);
  });
});
