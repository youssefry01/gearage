import { describe, expect, it } from "vitest";
import { brand, storeName } from "@/config/brand";
import { localeAlternates, openGraphFor, pageMetadata } from "./seo";

describe("localeAlternates", () => {
  it("builds canonical and hreflang for every locale plus x-default", () => {
    expect(localeAlternates("ar", "/cpus")).toEqual({
      canonical: "/ar/cpus",
      languages: { en: "/en/cpus", ar: "/ar/cpus", "x-default": "/en/cpus" },
    });
  });
});

describe("pageMetadata", () => {
  it("returns a COMPLETE Open Graph object (Next replaces nested metadata, it does not merge)", () => {
    const og = pageMetadata("en").openGraph as Record<string, unknown>;
    expect(og).toMatchObject({
      type: "website",
      siteName: storeName("en"),
      locale: "en_US",
      url: "/en",
    });
    expect(og["alternateLocale"]).toEqual(["ar_EG"]);
    expect(String(og["title"])).toContain(storeName("en"));
    expect(og["description"]).toBeTruthy();
    expect(og["images"]).toEqual([
      { url: brand.ogImage.src, width: 1200, height: 630, alt: storeName("en") },
    ]);
  });
  it("uses a page title and description when given", () => {
    const meta = pageMetadata("ar", { path: "/x", title: "T", description: "D" });
    expect(meta.description).toBe("D");
    expect(meta.openGraph).toMatchObject({
      title: `T | ${storeName("ar")}`,
      description: "D",
      url: "/ar/x",
    });
  });
  it("omits url in the layout default", () => {
    expect(openGraphFor("en")).not.toHaveProperty("url");
  });
});
