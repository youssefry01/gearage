import { describe, expect, it } from "vitest";
import { PLACEHOLDER_ROUTES, routeKeyForPath, routes } from "@/config/routes";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import { categoryPath } from "./href";

describe("category links", () => {
  it("builds the storefront path from a slug trail", () => {
    expect(categoryPath(["components"])).toBe("/c/components");
    expect(categoryPath(["components", "cpus", "amd-ryzen"])).toBe("/c/components/cpus/amd-ryzen");
  });
});

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
