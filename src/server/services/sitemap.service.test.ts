import { describe, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/domain/category-tree";
import { createSitemapService } from "./sitemap.service";

vi.mock("./category.service", () => ({ getCategoryTree: vi.fn() }));
vi.mock("./product.service", () => ({ listPublicProductSlugs: vi.fn() }));

const node = (path: string): CategoryNode => ({
  id: path,
  slug: path,
  path,
  depth: 1,
  name: { en: path, ar: path },
  description: { en: null, ar: null },
  seoTitle: { en: null, ar: null },
  seoDescription: { en: null, ar: null },
  imageKey: null,
  productCount: 1,
  children: [],
});

const clock = () => {
  let t = 0;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe("sitemap service", () => {
  it("lists static pages, categories and products", async () => {
    const svc = createSitemapService({
      loadCategories: async () => [node("components")],
      loadProductSlugs: async () => ["ryzen-5-7600"],
    });
    const { value, degraded } = await svc.get();
    expect(degraded).toBe(false);
    expect(value).toEqual(["", "/c/components", "/p/ryzen-5-7600"]);
  });

  it("serves the last good sitemap when the database fails later, never throwing", async () => {
    const c = clock();
    let fail = false;
    const onError = vi.fn();
    const svc = createSitemapService({
      loadCategories: async () => [node("components")],
      loadProductSlugs: async () => {
        if (fail) throw new Error("connection terminated");
        return ["a"];
      },
      onError,
      now: c.now,
    });
    const good = (await svc.get()).value;
    fail = true;
    c.advance(61 * 60 * 1000);
    const degraded = await svc.get();
    expect(degraded).toEqual({ value: good, degraded: true });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("serves the minimal sitemap (static pages only) on a cold start during an outage", async () => {
    const svc = createSitemapService({
      loadCategories: async () => {
        throw new Error("db down");
      },
      loadProductSlugs: async () => ["a"],
    });
    await expect(svc.get()).resolves.toEqual({ value: [""], degraded: true });
  });

  it("does not publish a half-built list: a failing product read fails the whole load", async () => {
    const svc = createSitemapService({
      loadCategories: async () => [node("components")],
      loadProductSlugs: async () => {
        throw new Error("timeout");
      },
    });
    const { value } = await svc.get();
    expect(value).toEqual([""]);
  });

  it("recovers after the retry window", async () => {
    const c = clock();
    let fail = true;
    const svc = createSitemapService({
      loadCategories: async () => {
        if (fail) throw new Error("x");
        return [node("components")];
      },
      loadProductSlugs: async () => [],
      now: c.now,
    });
    expect((await svc.get()).degraded).toBe(true);
    fail = false;
    c.advance(31_000);
    expect(await svc.get()).toEqual({ value: ["", "/c/components"], degraded: false });
  });
});
