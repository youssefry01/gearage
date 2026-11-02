import { isIP } from "node:net";

/**
 * The client IP, or null when it cannot be trusted. Forwarding headers are plain text that any caller can forge, so
 * they are read ONLY when a trusted proxy sets them: on Vercel (`VERCEL=1`, which sets them itself) or when
 * TRUST_PROXY_HEADERS=1 (exactly one proxy in front). The RIGHTMOST entry of x-forwarded-for is used: whether the proxy
 * replaces the header (one entry) or appends to it, that entry is the address the proxy saw. Never the leftmost.
 *
 * IPv6 addresses are reduced to their /64 prefix: one subscriber holds a whole /64, so per-address limits would be
 * trivially evaded by rotating the low bits.
 */
export function getClientIp(
  headers: Headers,
  trust: { onVercel: boolean; trustProxyHeaders: boolean },
): string | null {
  if (!trust.onVercel && !trust.trustProxyHeaders) return null;
  const candidates: (string | null)[] = [];
  if (trust.onVercel) candidates.push(headers.get("x-vercel-forwarded-for"));
  candidates.push(headers.get("x-forwarded-for"), headers.get("x-real-ip"));
  for (const raw of candidates) {
    if (!raw) continue;
    const last = raw.split(",").at(-1)?.trim();
    if (last && isIP(last)) return normalizeIp(last);
  }
  return null;
}

export function normalizeIp(ip: string): string {
  if (isIP(ip) === 4) return ip;
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is an IPv4 client.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1] && isIP(mapped[1]) === 4) return mapped[1];
  return `${ipv6Prefix64(ip)}::/64`;
}

/** The first four hextets of an IPv6 address, expanded and lower-cased (`2001:db8:0:1`). */
export function ipv6Prefix64(ip: string): string {
  const [head = "", tail] = ip.toLowerCase().split("::");
  const left = head === "" ? [] : head.split(":");
  const right = tail === undefined || tail === "" ? [] : tail.split(":");
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  const full = [...left, ...Array<string>(Math.max(0, missing)).fill("0"), ...right];
  return full
    .slice(0, 4)
    .map((h) => h.replace(/^0+(?=.)/, ""))
    .join(":");
}
