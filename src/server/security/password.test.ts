// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ARGON2_PARAMS,
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
  type PasswordConfig,
} from "./password";

const FAST = { memoryKib: 1024, timeCost: 1, parallelism: 1 };
const pepper1 = "pepper-one-pepper-one-pepper-one-0001";
const pepper2 = "pepper-two-pepper-two-pepper-two-0002";
const v1: PasswordConfig = { peppers: new Map([[1, pepper1]]), currentVersion: 1, params: FAST };
const v2: PasswordConfig = {
  peppers: new Map([
    [1, pepper1],
    [2, pepper2],
  ]),
  currentVersion: 2,
  params: FAST,
};

describe("password hashing", () => {
  it("uses Argon2id with the documented parameters and stores the pepper version", async () => {
    const stored = await hashPassword("a perfectly fine passphrase", {
      ...v1,
      params: ARGON2_PARAMS,
    });
    expect(stored).toMatch(
      /^pv1:\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/,
    );
  });
  it("uses a different random salt for the same password every time", async () => {
    const a = await hashPassword("same passphrase here", v1);
    const b = await hashPassword("same passphrase here", v1);
    expect(a).not.toBe(b);
  });
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("right horse battery", v1);
    expect(await verifyPassword("right horse battery", stored, v1)).toEqual({
      valid: true,
      needsRehash: false,
    });
    expect((await verifyPassword("wrong horse battery", stored, v1)).valid).toBe(false);
  });
  it("treats NFKC-equivalent spellings as the same password, with spaces and Arabic", async () => {
    const stored = await hashPassword("ｐａｓｓｗｏｒｄ كلمة سر", v1);
    expect((await verifyPassword("password كلمة سر", stored, v1)).valid).toBe(true);
  });
  it("a different pepper cannot verify (this is why the pepper must never be lost or changed)", async () => {
    const stored = await hashPassword("right horse battery", v1);
    const other: PasswordConfig = {
      peppers: new Map([[1, pepper2]]),
      currentVersion: 1,
      params: FAST,
    };
    expect((await verifyPassword("right horse battery", stored, other)).valid).toBe(false);
  });
  it("pepper rotation: old hashes still verify and are flagged for rehash; new ones are not", async () => {
    const old = await hashPassword("right horse battery", v1);
    expect(await verifyPassword("right horse battery", old, v2)).toEqual({
      valid: true,
      needsRehash: true,
    });
    const fresh = await hashPassword("right horse battery", v2);
    expect(fresh.startsWith("pv2:")).toBe(true);
    expect(await verifyPassword("right horse battery", fresh, v2)).toEqual({
      valid: true,
      needsRehash: false,
    });
    // a WRONG password is never flagged for rehash
    expect(await verifyPassword("nope nope nope nope", old, v2)).toEqual({
      valid: false,
      needsRehash: false,
    });
  });
  it("flags a hash made with weaker parameters", async () => {
    const weak = await hashPassword("right horse battery", v1);
    const stronger: PasswordConfig = {
      ...v1,
      params: { memoryKib: 2048, timeCost: 1, parallelism: 1 },
    };
    expect((await verifyPassword("right horse battery", weak, stronger)).needsRehash).toBe(true);
  });
  it("never throws for junk: corrupt hash, unknown pepper version, absurdly long input", async () => {
    expect((await verifyPassword("whatever whatever", "garbage", v1)).valid).toBe(false);
    const stored = await hashPassword("right horse battery", v2);
    expect((await verifyPassword("right horse battery", stored, v1)).valid).toBe(false); // pepper 2 not configured
    expect((await verifyPassword("x".repeat(5000), stored, v2)).valid).toBe(false);
  });
  it("refuses to hash without a pepper for the current version", async () => {
    await expect(
      hashPassword("right horse battery", { ...v1, currentVersion: 3 }),
    ).rejects.toThrow();
  });
  it("verifyAgainstDummy completes without a stored hash (login of an unknown account)", async () => {
    await expect(verifyAgainstDummy("whatever whatever", v1)).resolves.toBeUndefined();
  });
});
