import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { storeName } from "@/config/brand";
import { Logo } from "./logo";

const renderLogo = (locale: "en" | "ar") =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <Logo variant="inline" />
    </NextIntlClientProvider>,
  );

describe("Logo", () => {
  it.each(["en", "ar"] as const)(
    "exposes exactly one accessible image named after the brand (%s)",
    (locale) => {
      renderLogo(locale);
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: storeName(locale) })).toBeInTheDocument();
    },
  );
  it("renders both theme artworks, with the hidden one lazy and decorative", () => {
    const { container } = renderLogo("en");
    const dark = container.querySelector("img.logo-on-dark");
    const light = container.querySelector("img.logo-on-light");
    expect(dark).not.toBeNull();
    expect(light).toHaveAttribute("aria-hidden", "true");
    expect(light).toHaveAttribute("loading", "lazy");
    expect(light).toHaveAttribute("alt", "");
  });
});
