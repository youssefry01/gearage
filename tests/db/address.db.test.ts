import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, expectDbError, resetData } from "./helpers";

// Real PostgreSQL. Only the rate limiter is replaced (so a test can refuse a write); everything else is real.
let limiterAllows = true;
const hits: { policy: string; subject: string }[] = [];
vi.mock("@/server/security/rate-limit/limiter", () => ({
  getLimiter: () => ({
    hit: async (policy: { name: string }, subject: string) => {
      hits.push({ policy: policy.name, subject });
      return { allowed: limiterAllows, retryAfterSec: 60, unavailable: false };
    },
  }),
}));

const svc = await import("@/server/services/address.service");
const { addressSchema, ADDRESS_LIMITS, MAX_ADDRESSES } = await import("@/domain/address");

let n = 0;
async function makeUser() {
  n += 1;
  const now = new Date();
  return db().user.create({
    data: {
      name: "Mona Hassan",
      email: `mona${n}-${randomUUID().slice(0, 6)}@example.test`,
      emailVerified: true,
      firstName: "Mona",
      lastName: "Hassan",
      phone: "+201012345678",
      termsAcceptedAt: now,
      termsVersion: "test",
      privacyAcceptedAt: now,
      privacyVersion: "test",
      createdAt: now,
      updatedAt: now,
    },
  });
}

const valid = (over: Record<string, unknown> = {}) =>
  addressSchema.parse({
    recipientName: "Mona Hassan",
    phone: "010 1234 5678",
    governorate: "cairo",
    city: "Nasr City",
    area: "Seventh District",
    street: "Abbas El Akkad",
    building: "12",
    ...over,
  });

const rowsOf = (userId: string) =>
  db().address.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
const defaultsOf = async (userId: string) =>
  (await rowsOf(userId)).filter((r) => r.isDefault).map((r) => r.id);

beforeEach(async () => {
  limiterAllows = true;
  hits.length = 0;
  await resetData();
});

describe("creating", () => {
  it("makes the first address the default and later ones not, unless asked", async () => {
    const u = await makeUser();
    const first = await svc.createAddress(u.id, valid({ label: "Home" }));
    const second = await svc.createAddress(u.id, valid({ city: "Giza", governorate: "giza" }));
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
    const third = await svc.createAddress(u.id, { ...valid({ city: "Maadi" }), makeDefault: true });
    expect(third.isDefault).toBe(true);
    expect(await defaultsOf(u.id)).toEqual([third.id]);
  });

  it("stores the phone as E.164, optional lines as NULL and tidies spaces", async () => {
    const u = await makeUser();
    const a = await svc.createAddress(
      u.id,
      valid({ city: "  Nasr   City ", floor: "  ", apartment: "", landmark: undefined }),
    );
    expect(a.phone).toBe("+201012345678");
    expect(a.city).toBe("Nasr City");
    expect(a.floor).toBeNull();
    expect(a.apartment).toBeNull();
    expect(a.landmark).toBeNull();
    expect(a.label).toBeNull();
  });

  it("refuses the eleventh address with address_limit", async () => {
    const u = await makeUser();
    for (let i = 0; i < MAX_ADDRESSES; i += 1)
      await svc.createAddress(u.id, valid({ building: `${i}` }));
    await expect(svc.createAddress(u.id, valid())).rejects.toMatchObject({
      code: "CONFLICT",
      details: { issue: "address_limit" },
    });
    expect(await db().address.count({ where: { userId: u.id } })).toBe(MAX_ADDRESSES);
  });

  it("holds the limit and the one-default rule under concurrent requests", async () => {
    const u = await makeUser();
    const results = await Promise.allSettled(
      Array.from({ length: MAX_ADDRESSES + 6 }, (_, i) =>
        svc.createAddress(u.id, { ...valid({ building: `${i}` }), makeDefault: i % 2 === 0 }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(MAX_ADDRESSES);
    for (const r of results.filter((x) => x.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({
        details: { issue: "address_limit" },
      });
    }
    expect(await db().address.count({ where: { userId: u.id } })).toBe(MAX_ADDRESSES);
    expect(await defaultsOf(u.id)).toHaveLength(1);
  });

  it("one account at its limit does not affect another", async () => {
    const a = await makeUser();
    const b = await makeUser();
    for (let i = 0; i < MAX_ADDRESSES; i += 1)
      await svc.createAddress(a.id, valid({ building: `${i}` }));
    await expect(svc.createAddress(b.id, valid())).resolves.toMatchObject({ isDefault: true });
  });
});

describe("one default, always", () => {
  it("setting a default moves the flag in one step", async () => {
    const u = await makeUser();
    const a = await svc.createAddress(u.id, valid());
    const b = await svc.createAddress(u.id, valid({ building: "2" }));
    await svc.setDefaultAddress(u.id, b.id);
    expect(await defaultsOf(u.id)).toEqual([b.id]);
    await svc.setDefaultAddress(u.id, a.id);
    expect(await defaultsOf(u.id)).toEqual([a.id]);
  });

  it("concurrent set-default calls leave exactly one default", async () => {
    const u = await makeUser();
    const ids = [];
    for (let i = 0; i < 4; i += 1)
      ids.push((await svc.createAddress(u.id, valid({ building: `${i}` }))).id);
    await Promise.all(ids.map((id) => svc.setDefaultAddress(u.id, id)));
    expect(await defaultsOf(u.id)).toHaveLength(1);
  });

  it("the database refuses a second default whatever the code does", async () => {
    const u = await makeUser();
    const a = await svc.createAddress(u.id, valid());
    const other = await svc.createAddress(u.id, valid({ building: "2" }));
    await expectDbError(
      db().address.update({ where: { id: other.id }, data: { isDefault: true } }),
      /address_user_default_uq|unique/i,
    );
    expect(await defaultsOf(u.id)).toEqual([a.id]);
  });

  it("deleting the default promotes the most recently updated remaining address", async () => {
    const u = await makeUser();
    const t0 = new Date("2026-11-01T10:00:00Z");
    const a = await svc.createAddress(u.id, valid({ building: "a" }), { now: () => t0 });
    const b = await svc.createAddress(u.id, valid({ building: "b" }), {
      now: () => new Date(t0.getTime() + 1000),
    });
    const c = await svc.createAddress(u.id, valid({ building: "c" }), {
      now: () => new Date(t0.getTime() + 2000),
    });
    await svc.updateAddress(u.id, b.id, valid({ building: "b2" }), {
      now: () => new Date(t0.getTime() + 5000),
    });
    const res = await svc.deleteAddress(u.id, a.id);
    expect(res).toEqual({ status: "deleted", newDefaultId: b.id });
    expect(await defaultsOf(u.id)).toEqual([b.id]);
    // Deleting a non-default leaves the default alone; deleting the last one leaves none.
    await svc.deleteAddress(u.id, c.id);
    expect(await defaultsOf(u.id)).toEqual([b.id]);
    await svc.deleteAddress(u.id, b.id);
    expect(await rowsOf(u.id)).toHaveLength(0);
  });

  it("editing an address never changes which one is the default", async () => {
    const u = await makeUser();
    const a = await svc.createAddress(u.id, valid());
    const b = await svc.createAddress(u.id, valid({ building: "2" }));
    await svc.updateAddress(
      u.id,
      b.id,
      valid({ building: "22", landmark: "Next to the pharmacy" }),
    );
    await svc.updateAddress(u.id, a.id, valid({ building: "11" }));
    expect(await defaultsOf(u.id)).toEqual([a.id]);
    const list = await svc.listAddresses(u.id);
    expect(list[0]!.id).toBe(a.id); // default first
    expect(list.find((x) => x.id === b.id)!.landmark).toBe("Next to the pharmacy");
  });
});

describe("another account's addresses (no IDOR)", () => {
  it("an id that is not yours behaves exactly like an id that does not exist", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const mine = await svc.createAddress(owner.id, valid({ label: "Home" }));
    const before = await rowsOf(owner.id);
    const stranger = randomUUID();

    const attempts: Array<(id: string) => Promise<unknown>> = [
      (id) => svc.updateAddress(intruder.id, id, valid({ city: "Hacked" })),
      (id) => svc.setDefaultAddress(intruder.id, id),
      (id) => svc.deleteAddress(intruder.id, id),
    ];
    for (const attempt of attempts) {
      const foreign = await attempt(mine.id).catch((e: unknown) => e);
      const missing = await attempt(stranger).catch((e: unknown) => e);
      expect(foreign).toMatchObject({ code: "NOT_FOUND", details: { issue: "address_not_found" } });
      expect(missing).toMatchObject({ code: "NOT_FOUND", details: { issue: "address_not_found" } });
      expect((foreign as Error).message).toBe((missing as Error).message);
    }
    expect(await rowsOf(owner.id)).toEqual(before);
    expect(await svc.listAddresses(intruder.id)).toEqual([]);
  });

  it("an intruder cannot take the default flag away from the owner", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const mine = await svc.createAddress(owner.id, valid());
    await svc.createAddress(intruder.id, valid());
    await svc.setDefaultAddress(intruder.id, mine.id).catch(() => undefined);
    expect(await defaultsOf(owner.id)).toEqual([mine.id]);
    expect(await defaultsOf(intruder.id)).toHaveLength(1);
  });
});

describe("rate limit", () => {
  it("every write counts against the per-account budget BEFORE any work, and a refusal writes nothing", async () => {
    const u = await makeUser();
    const a = await svc.createAddress(u.id, valid());
    await svc.updateAddress(u.id, a.id, valid({ building: "2" }));
    await svc.setDefaultAddress(u.id, a.id);
    await svc.deleteAddress(u.id, a.id);
    expect(hits.filter((h) => h.policy === "auth.address.write.user")).toHaveLength(4);
    expect(hits.every((h) => h.subject === u.id)).toBe(true);

    limiterAllows = false;
    await expect(svc.createAddress(u.id, valid())).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(await rowsOf(u.id)).toHaveLength(0);
  });

  it("reading the book is free", async () => {
    const u = await makeUser();
    hits.length = 0;
    await svc.listAddresses(u.id);
    expect(hits).toHaveLength(0);
  });
});

describe("database rules", () => {
  const base = (userId: string) => ({
    userId,
    recipientName: "Mona Hassan",
    phone: "+201012345678",
    governorate: "cairo",
    city: "Nasr City",
    area: "Seventh District",
    street: "Abbas El Akkad",
    building: "12",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("refuses blank required lines, a bad phone and a malformed governorate code", async () => {
    const u = await makeUser();
    for (const bad of [
      { city: "   " },
      { street: "" },
      { recipientName: " " },
      { phone: "01012345678" },
      { phone: "+201312345678" },
      { governorate: "Cairo" },
      { governorate: "cairo!" },
      { governorate: "" },
      { label: "  " },
      { floor: "" },
    ]) {
      await expectDbError(
        db().address.create({ data: { ...base(u.id), ...bad } }),
        /check|constraint/i,
      );
    }
    expect(await rowsOf(u.id)).toHaveLength(0);
  });

  it("the form limits and the CHECK limits agree: the limit passes, one more is refused", async () => {
    const u = await makeUser();
    for (const [field, max] of Object.entries(ADDRESS_LIMITS)) {
      await expect(
        db().address.create({ data: { ...base(u.id), [field]: "x".repeat(max) } }),
        field,
      ).resolves.toBeTruthy();
      await expectDbError(
        db().address.create({ data: { ...base(u.id), [field]: "x".repeat(max + 1) } }),
        /check|constraint/i,
      );
    }
  });

  it("deleting the account deletes its addresses", async () => {
    const u = await makeUser();
    await svc.createAddress(u.id, valid());
    await db().user.delete({ where: { id: u.id } });
    expect(await db().address.count()).toBe(0);
  });
});
