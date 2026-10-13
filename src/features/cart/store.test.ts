import { beforeEach, describe, expect, it } from "vitest";
import { selectCartCount, useCartStore } from "./store";

const state = () => useCartStore.getState();

describe("cart store (M1b minimal)", () => {
  beforeEach(() => {
    localStorage.clear();
    state().clear();
  });

  it("counts units across lines", () => {
    state().add("a");
    state().add("a", 2);
    state().add("b");
    expect(selectCartCount(state())).toBe(4);
  });
  it("setQty replaces, and 0 or less removes the line", () => {
    state().add("a", 3);
    state().setQty("a", 5);
    expect(state().lines["a"]).toBe(5);
    state().setQty("a", 0);
    expect(state().lines).toEqual({});
  });
  it("remove and clear work", () => {
    state().add("a");
    state().add("b");
    state().remove("a");
    expect(Object.keys(state().lines)).toEqual(["b"]);
    state().clear();
    expect(selectCartCount(state())).toBe(0);
  });
  it("ignores NaN, negative and fractional quantities", () => {
    state().add("a", Number.NaN);
    state().add("b", -4);
    state().add("c", 2.9);
    expect(state().lines["a"] ?? 0).toBe(0);
    expect(state().lines["b"] ?? 0).toBe(0);
    expect(state().lines["c"]).toBe(2);
  });
  it("persists to localStorage and rehydrates on demand", async () => {
    state().add("a", 2);
    expect(JSON.parse(localStorage.getItem("cart") ?? "{}").state.lines).toEqual({ a: 2 });
    // Simulate a fresh page load: in-memory state is empty, but storage still holds the cart.
    // (setState persists too, so put the saved value back before rehydrating.)
    const saved = localStorage.getItem("cart") ?? "";
    useCartStore.setState({ lines: {} });
    localStorage.setItem("cart", saved);
    await useCartStore.persist.rehydrate();
    expect(state().lines).toEqual({ a: 2 });
  });
});
