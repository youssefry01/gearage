/**
 * Coarse device labels (M5b-1, ADR 0025). A sign-in is described only as "Chrome on Windows": a browser family and an
 * operating system, derived from the User-Agent at the moment of sign-in. The raw User-Agent is never stored (it is a
 * fingerprinting aid and says more than the shopper needs); only two short codes are, as `<browser>/<os>`.
 * Pure: no I/O. The codes are language-neutral, so the list shows "Chrome on Windows" in English and the Arabic
 * equivalent in Arabic from the same row (names of browsers and systems stay Latin, like the store name).
 */
export const BROWSERS = [
  "chrome",
  "edge",
  "firefox",
  "safari",
  "opera",
  "samsung",
  "unknown",
] as const;
export const SYSTEMS = [
  "windows",
  "macos",
  "ios",
  "android",
  "linux",
  "chromeos",
  "unknown",
] as const;
export type Browser = (typeof BROWSERS)[number];
export type System = (typeof SYSTEMS)[number];
export type DeviceParts = { browser: Browser; os: System };

/** Proper nouns, shown as-is in every language. */
export const BROWSER_NAMES: Record<Exclude<Browser, "unknown">, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  opera: "Opera",
  samsung: "Samsung Internet",
};
export const SYSTEM_NAMES: Record<Exclude<System, "unknown">, string> = {
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  chromeos: "ChromeOS",
};

/** The shape the database CHECK also enforces. */
export const DEVICE_CODE_PATTERN = /^[a-z0-9-]{1,24}\/[a-z0-9-]{1,24}$/;

/** Only the start of a User-Agent matters, and a bound keeps pattern matching cheap on hostile input. */
const MAX_USER_AGENT_LENGTH = 512;

function browserOf(ua: string): Browser {
  // Order matters: Edge, Opera and Samsung Internet all say "Chrome" too, and Chrome says "Safari".
  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return "edge";
  if (/\b(?:OPR|OPiOS)\/|\bOpera\b/.test(ua)) return "opera";
  if (/\bSamsungBrowser\//.test(ua)) return "samsung";
  if (/\b(?:Firefox|FxiOS)\//.test(ua)) return "firefox";
  if (/\b(?:Chrome|Chromium|CriOS)\//.test(ua)) return "chrome";
  if (/\bVersion\/[\d.]+.*\bSafari\//.test(ua)) return "safari";
  return "unknown";
}

function systemOf(ua: string): System {
  // Android's UA also says "Linux"; ChromeOS's says "X11; Linux"; iPadOS in desktop mode says "Macintosh" (and is
  // therefore reported as macOS: it cannot be told apart).
  if (/\bAndroid\b/.test(ua)) return "android";
  if (/\b(?:iPhone|iPad|iPod)\b/.test(ua)) return "ios";
  if (/\bWindows\b/.test(ua)) return "windows";
  if (/\bCrOS\b/.test(ua)) return "chromeos";
  if (/\b(?:Macintosh|Mac OS X)\b/.test(ua)) return "macos";
  if (/\b(?:Linux|X11)\b/.test(ua)) return "linux";
  return "unknown";
}

export function parseUserAgent(userAgent: string): DeviceParts {
  const ua = userAgent.slice(0, MAX_USER_AGENT_LENGTH);
  return { browser: browserOf(ua), os: systemOf(ua) };
}

export function encodeDevice(parts: DeviceParts): string | null {
  if (parts.browser === "unknown" && parts.os === "unknown") return null;
  return `${parts.browser}/${parts.os}`;
}

/** The code to store for a request's User-Agent, or null when nothing useful can be said about it. */
export function deviceFromUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return encodeDevice(parseUserAgent(userAgent));
}

/** Reads a stored code back. Anything that is not a known code reads as unknown (never throws). */
export function decodeDevice(code: string | null | undefined): DeviceParts | null {
  if (!code || !DEVICE_CODE_PATTERN.test(code)) return null;
  const [browser, os] = code.split("/") as [string, string];
  const parts: DeviceParts = {
    browser: (BROWSERS as readonly string[]).includes(browser) ? (browser as Browser) : "unknown",
    os: (SYSTEMS as readonly string[]).includes(os) ? (os as System) : "unknown",
  };
  return parts.browser === "unknown" && parts.os === "unknown" ? null : parts;
}

/** The translated sentence patterns. `both` uses {browser} and {os}; the others use one of them. */
export type DevicePatterns = { both: string; browserOnly: string; osOnly: string; unknown: string };

const fill = (pattern: string, values: Record<string, string>): string =>
  pattern.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** "Chrome on Windows", "Chrome", "Windows" or the translated "Unknown device". */
export function describeDevice(code: string | null | undefined, patterns: DevicePatterns): string {
  const parts = decodeDevice(code);
  if (!parts) return patterns.unknown;
  const browser = parts.browser === "unknown" ? null : BROWSER_NAMES[parts.browser];
  const os = parts.os === "unknown" ? null : SYSTEM_NAMES[parts.os];
  if (browser && os) return fill(patterns.both, { browser, os });
  if (browser) return fill(patterns.browserOnly, { browser });
  return fill(patterns.osOnly, { os: os! });
}
