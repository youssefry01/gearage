// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getClientIp, ipv6Prefix64 } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);
const trusted = { onVercel: false, trustProxyHeaders: true };

describe("getClientIp", () => {
  it("ignores every forwarding header unless a proxy is trusted (they are forgeable)", () => {
    expect(
      getClientIp(h({ "x-forwarded-for": "1.2.3.4" }), {
        onVercel: false,
        trustProxyHeaders: false,
      }),
    ).toBeNull();
  });
  it("takes the RIGHTMOST x-forwarded-for entry, never the client-controlled leftmost one", () => {
    expect(getClientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), trusted)).toBe(
      "203.0.113.9",
    );
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.9" }), trusted)).toBe("203.0.113.9");
  });
  it("prefers x-vercel-forwarded-for on Vercel", () => {
    const headers = h({
      "x-vercel-forwarded-for": "198.51.100.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.9",
    });
    expect(getClientIp(headers, { onVercel: true, trustProxyHeaders: false })).toBe("198.51.100.7");
  });
  it("falls back to x-real-ip and rejects values that are not IP addresses", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.5" }), trusted)).toBe("203.0.113.5");
    expect(getClientIp(h({ "x-forwarded-for": "not-an-ip" }), trusted)).toBeNull();
    expect(getClientIp(h({}), trusted)).toBeNull();
  });
  it("treats an IPv4-mapped IPv6 address as IPv4 and reduces IPv6 to its /64", () => {
    expect(getClientIp(h({ "x-real-ip": "::ffff:203.0.113.5" }), trusted)).toBe("203.0.113.5");
    const a = getClientIp(h({ "x-real-ip": "2001:db8:1:2:aaaa:bbbb:cccc:dddd" }), trusted);
    const b = getClientIp(h({ "x-real-ip": "2001:db8:1:2:1111:2222:3333:4444" }), trusted);
    expect(a).toBe(b);
    expect(a).toBe("2001:db8:1:2::/64");
  });
});

describe("ipv6Prefix64", () => {
  it("expands :: and drops leading zeros", () => {
    expect(ipv6Prefix64("2001:0db8::1")).toBe("2001:db8:0:0");
    expect(ipv6Prefix64("::1")).toBe("0:0:0:0");
    expect(ipv6Prefix64("fe80::a:b:c:d")).toBe("fe80:0:0:0");
  });
});
