import { describe, expect, it } from "vitest";
import { PLACEHOLDER_ROUTES, routeKeyForPath, routes } from "@/config/routes";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import {
  allCategoryTrails,
  categoryName,
  categoryPath,
  findCategory,
  navCategories,
  type NavCategory,
} from "./categories";

const walk = (nodes: NavCategory[], fn: (n: NavCategory, depth: number) => void, depth = 1) =>
  nodes.forEach((n) => {
    fn(n, depth);
    walk(n.children ?? [], fn, depth + 1);
  });

describe("category tree", () => {
  it("has kebab-case slugs, unique among siblings, max depth 3", () => {
    walk(navCategories, (n, depth) => {
      expect(n.slug, n.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(depth).toBeLessThanOrEqual(3);
      const siblings = (findParent(n)?.children ?? navCategories).map((s) => s.slug);
      expect(new Set(siblings).size).toBe(siblings.length);
      expect(n.children?.length ?? 1).toBeGreaterThan(0);
    });
  });
  it("names every node in English and Arabic", () => {
    walk(navCategories, (n) => {
      expect(n.name.en.trim(), n.slug).not.toBe("");
      expect(n.name.ar.trim(), n.slug).not.toBe("");
    });
    expect(categoryName(navCategories[0] as NavCategory, "ar")).toBe(
      (navCategories[0] as NavCategory).name.ar,
    );
  });
  it("resolves trails to nodes and rejects unknown ones", () => {
    expect(findCategory(["components", "graphics-cards", "nvidia-geforce"])?.chain).toHaveLength(3);
    expect(findCategory(["components", "nope"])).toBeUndefined();
    expect(findCategory([])).toBeUndefined();
  });
  it("every trail round-trips through its path", () => {
    for (const trail of allCategoryTrails()) {
      expect(findCategory(trail)).toBeDefined();
      expect(categoryPath(trail)).toBe(`/c/${trail.join("/")}`);
    }
    expect(allCategoryTrails().length).toBeGreaterThan(30);
  });
});

function findParent(
  target: NavCategory,
  nodes: NavCategory[] = navCategories,
): NavCategory | undefined {
  for (const n of nodes) {
    if (n.children?.includes(target)) return n;
    const deeper = findParent(target, n.children ?? []);
    if (deeper) return deeper;
  }
  return undefined;
}

describe("route registry", () => {
  it("has unique, absolute paths", () => {
    const paths = Object.values(routes);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p.startsWith("/")).toBe(true);
  });
  it("resolves placeholder paths with or without slashes, never home", () => {
    expect(routeKeyForPath("/cart")).toBe("cart");
    expect(routeKeyForPath("cart/")).toBe("cart");
    expect(routeKeyForPath("/shipping-delivery")).toBe("shipping");
    expect(routeKeyForPath("/")).toBeUndefined();
    expect(routeKeyForPath("/nope")).toBeUndefined();
  });
  it("has a title message in every locale for each placeholder route", () => {
    for (const key of PLACEHOLDER_ROUTES) {
      expect((en.Routes as Record<string, string>)[key], `en ${key}`).toBeTruthy();
      expect((ar.Routes as Record<string, string>)[key], `ar ${key}`).toBeTruthy();
    }
  });
});
