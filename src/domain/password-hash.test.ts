import { describe, expect, it } from "vitest";
import { formatStoredHash, needsRehash, parseStoredHash } from "./password-hash";

const phc = "$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNo";
const params = { memoryKib: 65536, timeCost: 3, parallelism: 1 };

describe("stored password hash format", () => {
  it("round-trips pepper version, PHC string and parameters", () => {
    const stored = formatStoredHash(1, phc);
    expect(stored).toBe(`pv1:${phc}`);
    expect(parseStoredHash(stored)).toEqual({ pepperVersion: 1, phc, params });
  });
  it("rejects anything that is not our format", () => {
    for (const bad of [
      "",
      phc,
      "pv0:" + phc,
      "pv1:$argon2i$v=19$m=1,t=1,p=1$YQ$YQ",
      "pv1:plaintext",
      "pvx:" + phc,
    ]) {
      expect(parseStoredHash(bad)).toBeNull();
    }
  });
  it("asks for a rehash on an old pepper version or old parameters, not otherwise", () => {
    const stored = parseStoredHash(formatStoredHash(1, phc))!;
    expect(needsRehash(stored, { pepperVersion: 1, params })).toBe(false);
    expect(needsRehash(stored, { pepperVersion: 2, params })).toBe(true);
    expect(needsRehash(stored, { pepperVersion: 1, params: { ...params, memoryKib: 19456 } })).toBe(
      true,
    );
    expect(needsRehash(stored, { pepperVersion: 1, params: { ...params, timeCost: 4 } })).toBe(
      true,
    );
  });
});
