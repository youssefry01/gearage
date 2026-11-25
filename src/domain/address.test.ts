import { describe, expect, it } from "vitest";
import {
  ADDRESS_LIMITS,
  addressSchema,
  createAddressSchema,
  formatAddressLines,
  MAX_ADDRESSES,
  pickNewDefault,
  tidy,
  updateAddressSchema,
} from "./address";
import {
  GOVERNORATES,
  GOVERNORATE_CODES,
  governorateName,
  isGovernorateCode,
  sortedGovernorates,
} from "./egypt-governorates";

const ok = {
  recipientName: "Mona Hassan",
  phone: "010 1234 5678",
  governorate: "cairo",
  city: "Nasr City",
  area: "Seventh District",
  street: "Abbas El Akkad",
  building: "12",
};

const issues = (input: unknown) => {
  const r = addressSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("governorates", () => {
  it("lists Egypt's 27 governorates, each with a unique code and both names", () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(new Set(GOVERNORATE_CODES).size).toBe(27);
    for (const g of GOVERNORATES) {
      expect(g.code, g.code).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(g.code.length).toBeLessThanOrEqual(24);
      expect(g.en.length).toBeGreaterThan(2);
      expect(g.ar).toMatch(/[\u0600-\u06FF]/);
    }
  });
  it("looks names up by code and never throws on an unknown one", () => {
    expect(governorateName("kafr-el-sheikh", "en")).toBe("Kafr El Sheikh");
    expect(governorateName("cairo", "ar")).toBe("القاهرة");
    expect(governorateName("atlantis", "en")).toBe("atlantis");
    expect(isGovernorateCode("giza")).toBe(true);
    expect(isGovernorateCode("Giza")).toBe(false);
  });
  it("sorts names in the page language and keeps every governorate", () => {
    for (const locale of ["en", "ar"] as const) {
      const list = sortedGovernorates(locale);
      expect(list).toHaveLength(27);
      expect(new Set(list.map((g) => g.code)).size).toBe(27);
    }
    expect(sortedGovernorates("en")[0]!.name).toBe("Alexandria");
  });
});

describe("addressSchema", () => {
  it("accepts a complete address and normalizes it", () => {
    const r = addressSchema.parse({ ...ok, city: "  Nasr   City ", label: " Home ", floor: " 3 " });
    expect(r).toMatchObject({
      phone: "+201012345678",
      city: "Nasr City",
      label: "Home",
      floor: "3",
      apartment: null,
      landmark: null,
    });
  });
  it("treats empty, null and missing optional lines the same: null", () => {
    for (const empty of ["", "   ", null, undefined]) {
      const r = addressSchema.parse({
        ...ok,
        floor: empty,
        apartment: empty,
        landmark: empty,
        label: empty,
      });
      expect([r.floor, r.apartment, r.landmark, r.label]).toEqual([null, null, null, null]);
    }
    const missing = addressSchema.parse(ok);
    expect(missing.floor).toBeNull();
  });
  it("accepts Arabic text and Arabic-Indic digits in the phone", () => {
    const r = addressSchema.parse({
      ...ok,
      recipientName: "منى حسن",
      city: "مدينة نصر",
      area: "الحي السابع",
      street: "عباس العقاد",
      building: "١٢",
      phone: "٠١٠١٢٣٤٥٦٧٨",
    });
    expect(r.phone).toBe("+201012345678");
    expect(r.building).toBe("١٢");
  });
  it("reports a code per field", () => {
    expect(issues({ ...ok, city: "" })).toContain("city:required");
    expect(issues({ ...ok, street: "   " })).toContain("street:required");
    expect(issues({ ...ok, phone: "12345" })).toContain("phone:invalid_phone");
    expect(issues({ ...ok, governorate: "" })).toContain("governorate:invalid_governorate");
    expect(issues({ ...ok, governorate: "atlantis" })).toContain("governorate:invalid_governorate");
    expect(issues({ ...ok, recipientName: "12345" })).toContain("recipientName:invalid_name");
    expect(issues({ ...ok, area: undefined })).toContain("area:required");
  });
  it("enforces each length limit exactly (the migration's CHECKs use the same numbers)", () => {
    for (const [field, max] of Object.entries(ADDRESS_LIMITS)) {
      const base = { ...ok };
      const letters = (n: number) => "a".repeat(n);
      expect(issues({ ...base, [field]: letters(max) }), field).toEqual([]);
      expect(issues({ ...base, [field]: letters(max + 1) }), field).toContain(`${field}:too_long`);
    }
  });
  it("rejects control characters and line breaks", () => {
    expect(issues({ ...ok, street: "Abbas\nEl Akkad" })).toContain("street:invalid_text");
    expect(issues({ ...ok, landmark: "near\u0000pharmacy" })).toContain("landmark:invalid_text");
    expect(issues({ ...ok, city: "Nasr\u2028City" })).toContain("city:invalid_text");
  });
  it("create adds only the optional default flag; update needs a UUID", () => {
    expect(createAddressSchema.parse({ ...ok, makeDefault: true }).makeDefault).toBe(true);
    expect(createAddressSchema.parse(ok).makeDefault).toBeUndefined();
    const id = "0195f3a0-7c11-7000-8000-000000000001";
    expect(updateAddressSchema.safeParse({ ...ok, addressId: id }).success).toBe(true);
    expect(updateAddressSchema.safeParse({ ...ok, addressId: "nope" }).success).toBe(false);
  });
  it("cannot smuggle the owner or the default flag through an update", () => {
    const parsed = updateAddressSchema.parse({
      ...ok,
      addressId: "0195f3a0-7c11-7000-8000-000000000001",
      userId: "x",
      isDefault: true,
    });
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("isDefault");
  });
});

describe("helpers", () => {
  it("MAX_ADDRESSES is ten", () => expect(MAX_ADDRESSES).toBe(10));
  it("tidy collapses whitespace", () => expect(tidy("  a \t b\n c ")).toBe("a b c"));
  it("formatAddressLines orders the lines and skips what is empty", () => {
    const words = { floor: "Floor", apartment: "Apt", landmark: "Landmark" };
    const base = {
      governorate: "giza",
      city: "Dokki",
      area: "Mesaha",
      street: "Tahrir St",
      building: "5",
      floor: null,
      apartment: null,
      landmark: null,
    };
    expect(formatAddressLines(base, "en", words)).toEqual([
      "5, Tahrir St",
      "Mesaha, Dokki",
      "Giza",
    ]);
    expect(
      formatAddressLines(
        { ...base, floor: "2", apartment: "9", landmark: "Next to the bank" },
        "ar",
        words,
      ),
    ).toEqual([
      "5, Tahrir St",
      "Floor 2, Apt 9",
      "Mesaha, Dokki",
      "الجيزة",
      "Landmark: Next to the bank",
    ]);
  });
  it("pickNewDefault takes the most recently updated, then the newest, then a stable id", () => {
    const d = (s: string) => new Date(`2026-11-${s}T00:00:00Z`);
    expect(pickNewDefault([])).toBeNull();
    const rest = [
      { id: "a", updatedAt: d("02"), createdAt: d("01") },
      { id: "b", updatedAt: d("05"), createdAt: d("02") },
      { id: "c", updatedAt: d("05"), createdAt: d("03") },
    ];
    expect(pickNewDefault(rest)!.id).toBe("c");
    expect(pickNewDefault([rest[0]!, rest[1]!])!.id).toBe("b");
  });
});
