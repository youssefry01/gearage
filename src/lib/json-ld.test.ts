import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  productJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "./json-ld";

const base = {
  name: "AMD Ryzen 7 7800X3D",
  description: "8 cores",
  url: "https://shop.example/en/p/ryzen",
  images: ["https://shop.example/uploads/a.jpg"],
  sku: "CPU-1",
  mpn: "100-100000910WOF",
  brandName: "AMD",
  condition: "NEW" as const,
  offer: { price: 1_850_000, available: 4 },
  inLanguage: "en",
};

describe("serializeJsonLd", () => {
  it("cannot be broken out of a script element", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>", x: "a\u2028b" });
    expect(out).not.toContain("<");
    expect(out).not.toContain("\u2028");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>", x: "a\u2028b" });
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from 1 and carries absolute URLs", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", url: "https://shop.example/en" },
      { name: "CPUs", url: "https://shop.example/en/c/components/cpus" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]?.item).toBe("https://shop.example/en/c/components/cpus");
  });
});

describe("breadcrumbJsonLd without a URL", () => {
  it("omits item instead of inventing a URL", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", url: "https://shop.example/en" },
      { name: "Page" },
    ]);
    expect(ld.itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "Page" });
  });
});

describe("productJsonLd", () => {
  it("emits an EGP offer with an exact decimal price and availability from stock", () => {
    const ld = productJsonLd(base);
    expect(ld.offers).toMatchObject({
      priceCurrency: "EGP",
      price: "18500.00",
      availability: "https://schema.org/InStock",
    });
    expect(ld.brand).toEqual({ "@type": "Brand", name: "AMD" });
    expect(
      productJsonLd({ ...base, offer: { price: 100, available: 0 } }).offers?.availability,
    ).toBe("https://schema.org/OutOfStock");
    expect(
      productJsonLd({ ...base, offer: { price: 100, available: null } }).offers?.availability,
    ).toBe("https://schema.org/InStock");
  });

  it("leaves out the offer, optional fields and empty images when they are not known", () => {
    const ld = productJsonLd({
      ...base,
      offer: null,
      mpn: null,
      brandName: null,
      description: null,
      images: [],
    });
    expect(ld).not.toHaveProperty("offers");
    expect(ld).not.toHaveProperty("mpn");
    expect(ld).not.toHaveProperty("brand");
    expect(ld).not.toHaveProperty("description");
    expect(ld).not.toHaveProperty("image");
  });

  it("never invents a rating", () => {
    expect(JSON.stringify(productJsonLd(base))).not.toMatch(/aggregateRating|review/i);
  });
});

describe("organizationJsonLd and websiteJsonLd", () => {
  it("carry only brand facts: no contact points, profiles or search action", () => {
    const org = organizationJsonLd({
      name: "Shop",
      url: "https://shop.example",
      logo: "https://shop.example/brand/logo.png",
    });
    expect(org).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Shop",
      url: "https://shop.example",
      logo: "https://shop.example/brand/logo.png",
    });
    const site = websiteJsonLd({ name: "Shop", url: "https://shop.example/en", inLanguage: "en" });
    expect(site["@type"]).toBe("WebSite");
    expect(site).not.toHaveProperty("potentialAction");
  });
});
