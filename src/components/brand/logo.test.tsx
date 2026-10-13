import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { storeName } from "@/config/brand";
import { Logo } from "./logo";

const renderLogo = (locale: "en" | "ar", preload = false) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <Logo variant="inline" preload={preload} />
    </NextIntlClientProvider>,
  );

describe("Logo", () => {
  it.each(["en", "ar"] as const)(
    "is named after the brand by text, with both artworks decorative (%s)",
    (locale) => {
      const { container } = renderLogo(locale);
      expect(screen.getByText(storeName(locale))).toBeInTheDocument();
      expect(screen.queryAllByRole("img")).toHaveLength(0); // decorative images are not exposed
      for (const img of container.querySelectorAll("img")) {
        expect(img).toHaveAttribute("alt", "");
        expect(img).toHaveAttribute("aria-hidden", "true");
      }
    },
  );
  it("keeps its name inside a link whichever artwork is visible (regression: unlabeled home link in light mode)", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <a href="https://example.com/">
          <Logo variant="inline" />
        </a>
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("link", { name: storeName("en") })).toBeInTheDocument();
  });
  it("renders both theme artworks", () => {
    const { container } = renderLogo("en");
    expect(container.querySelector("img.logo-on-dark")).not.toBeNull();
    expect(container.querySelector("img.logo-on-light")).not.toBeNull();
  });
  it("below the fold the hidden artwork is lazy; above the fold BOTH are eager (LCP: the visible one depends on theme)", () => {
    const below = renderLogo("en").container;
    expect(below.querySelector("img.logo-on-light")).toHaveAttribute("loading", "lazy");
    cleanup();
    const above = renderLogo("en", true).container;
    for (const cls of ["logo-on-dark", "logo-on-light"]) {
      const img = above.querySelector(`img.${cls}`);
      expect(img, cls).not.toHaveAttribute("loading", "lazy");
      expect(img, cls).toHaveAttribute("fetchpriority", "high");
    }
  });
});
