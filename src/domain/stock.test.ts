import { describe, expect, it } from "vitest";
import {
  bundleMaxSellable,
  canTransitionReservation,
  expandDemand,
  findShortages,
  holdsStock,
  StockError,
  stockLevel,
  type BundleComposition,
} from "./stock";

const compositions: BundleComposition = new Map([
  [
    "bundle-1",
    [
      { componentId: "cpu", quantity: 1 },
      { componentId: "ram", quantity: 2 },
    ],
  ],
  [
    "bundle-2",
    [
      { componentId: "ram", quantity: 1 },
      { componentId: "gpu", quantity: 1 },
    ],
  ],
]);

describe("expandDemand", () => {
  it("expands bundles into components and AGGREGATES across lines, sorted by product id", () => {
    const demand = expandDemand(
      [
        { productId: "ram", type: "PHYSICAL", quantity: 1 },
        { productId: "bundle-1", type: "BUNDLE", quantity: 2 }, // cpu 2, ram 4
        { productId: "bundle-2", type: "BUNDLE", quantity: 1 }, // ram 1, gpu 1
        { productId: "ram", type: "PHYSICAL", quantity: 3 },
      ],
      compositions,
    );
    expect(demand).toEqual([
      { productId: "cpu", quantity: 2 },
      { productId: "gpu", quantity: 1 },
      { productId: "ram", quantity: 9 }, // 1 + 4 + 1 + 3
    ]);
  });
  it("is independent of line order (deterministic lock order)", () => {
    const a = expandDemand(
      [
        { productId: "z", type: "PHYSICAL", quantity: 1 },
        { productId: "a", type: "PHYSICAL", quantity: 1 },
      ],
      compositions,
    );
    const b = expandDemand(
      [
        { productId: "a", type: "PHYSICAL", quantity: 1 },
        { productId: "z", type: "PHYSICAL", quantity: 1 },
      ],
      compositions,
    );
    expect(a).toEqual(b);
    expect(a.map((d) => d.productId)).toEqual(["a", "z"]);
  });
  it("ignores products that need no stock", () => {
    expect(
      expandDemand(
        [
          { productId: "gift", type: "GIFT_CARD", quantity: 2 },
          { productId: "dl", type: "DIGITAL", quantity: 1 },
        ],
        compositions,
      ),
    ).toEqual([]);
  });
  it("rejects bad quantities and unknown or empty bundles", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() =>
        expandDemand([{ productId: "x", type: "PHYSICAL", quantity }], compositions),
      ).toThrow(StockError);
    }
    expect(() =>
      expandDemand([{ productId: "nope", type: "BUNDLE", quantity: 1 }], compositions),
    ).toThrow(/no components/);
  });
});

describe("findShortages", () => {
  const demand = [
    { productId: "a", quantity: 3 },
    { productId: "b", quantity: 1 },
    { productId: "c", quantity: 2 },
  ];
  it("lists every product that cannot be fully served, treating a missing product as 0", () => {
    const shortages = findShortages(
      demand,
      new Map([
        ["a", 2],
        ["b", 1],
      ]),
    );
    expect(shortages).toEqual([
      { productId: "a", requested: 3, available: 2 },
      { productId: "c", requested: 2, available: 0 },
    ]);
  });
  it("is empty when everything is available", () => {
    expect(
      findShortages(
        demand,
        new Map([
          ["a", 3],
          ["b", 5],
          ["c", 2],
        ]),
      ),
    ).toEqual([]);
  });
});

describe("bundleMaxSellable (twin of the SQL view)", () => {
  const items = [
    { componentId: "cpu", quantity: 1 },
    { componentId: "ram", quantity: 2 },
  ];
  const avail = (cpu: number, ram: number, sellable = true) =>
    new Map([
      ["cpu", { available: cpu, sellable }],
      ["ram", { available: ram, sellable }],
    ]);
  it("is the minimum over floor(available / quantity)", () => {
    expect(bundleMaxSellable(items, avail(10, 7))).toBe(3); // ram: floor(7/2) = 3
    expect(bundleMaxSellable(items, avail(2, 100))).toBe(2);
    expect(bundleMaxSellable(items, avail(0, 100))).toBe(0);
  });
  it("is 0 when any component is not sellable, missing, or the bundle is empty", () => {
    expect(bundleMaxSellable(items, avail(10, 10, false))).toBe(0);
    expect(bundleMaxSellable(items, new Map([["cpu", { available: 5, sellable: true }]]))).toBe(0);
    expect(bundleMaxSellable([], avail(10, 10))).toBe(0);
  });
});

describe("stockLevel", () => {
  it("classifies availability", () => {
    expect(stockLevel(0, 3)).toBe("out");
    expect(stockLevel(-1, 3)).toBe("out");
    expect(stockLevel(3, 3)).toBe("low");
    expect(stockLevel(4, 3)).toBe("in");
    expect(stockLevel(null, 3)).toBe("in");
  });
});

describe("reservations", () => {
  it("only ACTIVE can resolve, and resolved states are final", () => {
    expect(canTransitionReservation("ACTIVE", "CONVERTED")).toBe(true);
    expect(canTransitionReservation("ACTIVE", "RELEASED")).toBe(true);
    expect(canTransitionReservation("ACTIVE", "EXPIRED")).toBe(true);
    expect(canTransitionReservation("ACTIVE", "ACTIVE")).toBe(false);
    expect(canTransitionReservation("CONVERTED", "ACTIVE")).toBe(false);
    expect(canTransitionReservation("EXPIRED", "CONVERTED")).toBe(false);
  });
  it("an ACTIVE reservation stops holding stock the moment it expires", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    expect(holdsStock({ status: "ACTIVE", expiresAt: new Date("2026-10-14T10:00:01Z") }, now)).toBe(
      true,
    );
    expect(holdsStock({ status: "ACTIVE", expiresAt: new Date("2026-10-14T10:00:00Z") }, now)).toBe(
      false,
    );
    expect(holdsStock({ status: "RELEASED", expiresAt: new Date("2027-01-01Z") }, now)).toBe(false);
  });
});
