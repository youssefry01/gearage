import { describe, expect, it } from "vitest";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  consentCookieString,
  makeConsent,
  parseConsent,
  readConsent,
  serializeConsent,
} from "./consent";

describe("consent", () => {
  it("round-trips", () => {
    const c = makeConsent(true, 1_700_000_000_000);
    expect(parseConsent(serializeConsent(c))).toEqual(c);
    expect(parseConsent(serializeConsent(makeConsent(false, 5)))?.analytics).toBe(false);
  });
  it.each([
    [undefined],
    [null],
    [""],
    ["not json"],
    [encodeURIComponent("[]")],
    [encodeURIComponent('{"v":2,"analytics":true,"ts":1}')],
    [encodeURIComponent('{"v":1,"analytics":"yes","ts":1}')],
    [encodeURIComponent('{"v":1,"analytics":true,"ts":"now"}')],
    ["%E0%A4%A"],
  ])("rejects invalid cookie value %j", (raw) => expect(parseConsent(raw)).toBeNull());

  it("builds a first-party cookie with safe attributes", () => {
    const secure = consentCookieString(makeConsent(true, 1), true);
    expect(secure).toContain(`${CONSENT_COOKIE}=`);
    expect(secure).toContain(`Max-Age=${CONSENT_MAX_AGE_SECONDS}`);
    expect(secure).toContain("SameSite=Lax");
    expect(secure).toContain("Path=/");
    expect(secure).toContain("Secure");
    expect(consentCookieString(makeConsent(true, 1), false)).not.toContain("Secure");
  });
  it("reads the record out of a document.cookie string", () => {
    const c = makeConsent(true, 9);
    expect(readConsent(`a=1; ${CONSENT_COOKIE}=${serializeConsent(c)}; NEXT_LOCALE=ar`)).toEqual(c);
    expect(readConsent("a=1; NEXT_LOCALE=ar")).toBeNull();
  });
});
