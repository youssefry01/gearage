import { describe, expect, it } from "vitest";
import { LocalStorageProvider } from "./local";
import { publicImageUrl } from "./public-url";

describe("publicImageUrl", () => {
  it("matches the local provider's URLs", () => {
    const local = new LocalStorageProvider("/tmp/x", "/uploads");
    for (const key of ["products/abc123.svg", "categories/components/cpus.svg", "a/b/c-d.png"])
      expect(publicImageUrl(key, "/uploads")).toBe(local.urlFor(key));
  });
  it("trims trailing slashes on the base and rejects unsafe keys", () => {
    expect(publicImageUrl("a/b.png", "https://cdn.example/img//")).toBe(
      "https://cdn.example/img/a/b.png",
    );
    expect(() => publicImageUrl("../etc/passwd")).toThrow();
  });
});
