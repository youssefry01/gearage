import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME,
  parseTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "./theme";

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
  it("sets the default theme when nothing is stored, so the attribute always exists", () => {
    document.documentElement.removeAttribute("data-theme");
    new Function(themeInitScript)();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
  });
  it("never throws when storage is unavailable, and still sets the default", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
    document.documentElement.removeAttribute("data-theme");
    expect(() => new Function(themeInitScript)()).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
    Storage.prototype.getItem = original;
  });
});

describe("readStoredTheme / applyTheme (used by ThemeSync after a locale switch)", () => {
  afterEach(() => localStorage.clear());

  it("restores the stored preference, else the default", () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredTheme()).toBe("light");
    localStorage.setItem(THEME_STORAGE_KEY, "garbage");
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });
  it("falls back to the default when storage throws", () => {
    expect(
      readStoredTheme({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(DEFAULT_THEME);
  });
  it("writes data-theme", () => {
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("system");
  });
});
