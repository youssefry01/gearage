import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, THEME_STORAGE_KEY, themeInitScript } from "./theme";

describe("theme preference", () => {
  it("defaults to the brand-native dark theme", () => expect(DEFAULT_THEME).toBe("dark"));
  it("parses only known values", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("blue")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
});

describe("themeInitScript", () => {
  beforeEach(() => document.documentElement.setAttribute("data-theme", "dark"));
  afterEach(() => localStorage.clear());

  it("applies a saved light preference before paint", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    new Function(themeInitScript)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  it("ignores unknown stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    new Function(themeInitScript)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("never throws when storage is unavailable", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
    expect(() => new Function(themeInitScript)()).not.toThrow();
    Storage.prototype.getItem = original;
  });
});
