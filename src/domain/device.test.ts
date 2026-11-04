import { describe, expect, it } from "vitest";
import {
  decodeDevice,
  describeDevice,
  deviceFromUserAgent,
  DEVICE_CODE_PATTERN,
  parseUserAgent,
  type DevicePatterns,
} from "./device";

const UA = {
  chromeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.37 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  operaWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

describe("parseUserAgent", () => {
  it.each([
    [UA.chromeWin, "chrome/windows"],
    [UA.edgeWin, "edge/windows"],
    [UA.firefoxMac, "firefox/macos"],
    [UA.safariMac, "safari/macos"],
    [UA.safariIphone, "safari/ios"],
    [UA.chromeIphone, "chrome/ios"],
    [UA.chromeAndroid, "chrome/android"],
    [UA.samsung, "samsung/android"],
    [UA.operaWin, "opera/windows"],
    [UA.firefoxLinux, "firefox/linux"],
    [UA.chromeOs, "chrome/chromeos"],
  ])("reads %#", (ua, code) => {
    expect(deviceFromUserAgent(ua)).toBe(code);
  });

  it("says nothing when nothing is recognised", () => {
    expect(deviceFromUserAgent("curl/8.5.0")).toBeNull();
    expect(deviceFromUserAgent("")).toBeNull();
    expect(deviceFromUserAgent(null)).toBeNull();
    expect(deviceFromUserAgent(undefined)).toBeNull();
  });

  it("keeps a partial answer (a known system with an unknown browser)", () => {
    expect(deviceFromUserAgent("SomeApp/1.0 (Android 14)")).toBe("unknown/android");
  });

  it("only ever produces the stored shape, whatever the input (so a raw User-Agent can never be stored)", () => {
    for (const ua of Object.values(UA)) {
      const code = deviceFromUserAgent(ua);
      expect(code).toMatch(DEVICE_CODE_PATTERN);
      expect(code).not.toContain(" ");
    }
    expect(deviceFromUserAgent("x".repeat(100_000) + "Chrome/1 Windows")).toBeNull();
  });

  it("returns parts", () => {
    expect(parseUserAgent(UA.edgeWin)).toEqual({ browser: "edge", os: "windows" });
  });
});

const en: DevicePatterns = {
  both: "{browser} on {os}",
  browserOnly: "{browser}",
  osOnly: "{os}",
  unknown: "Unknown device",
};
const ar: DevicePatterns = {
  both: "{browser} على {os}",
  browserOnly: "{browser}",
  osOnly: "{os}",
  unknown: "جهاز غير معروف",
};

describe("describeDevice", () => {
  it("builds the label in the page language from the language-neutral code", () => {
    expect(describeDevice("chrome/windows", en)).toBe("Chrome on Windows");
    expect(describeDevice("chrome/windows", ar)).toBe("Chrome على Windows");
    expect(describeDevice("samsung/android", en)).toBe("Samsung Internet on Android");
  });
  it("handles a half-known device and an unknown one", () => {
    expect(describeDevice("unknown/android", en)).toBe("Android");
    expect(describeDevice("firefox/unknown", en)).toBe("Firefox");
    expect(describeDevice(null, en)).toBe("Unknown device");
    expect(describeDevice(null, ar)).toBe("جهاز غير معروف");
  });
  it("never trusts a stored value: junk reads as unknown instead of being shown", () => {
    expect(describeDevice("<script>/x", en)).toBe("Unknown device");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0)", en)).toBe("Unknown device");
    expect(describeDevice("netscape/beos", en)).toBe("Unknown device");
    expect(decodeDevice("chrome/windows")).toEqual({ browser: "chrome", os: "windows" });
  });
});
