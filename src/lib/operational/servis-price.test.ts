import { describe, expect, it } from "vitest";
import { servisPrice } from "./servis-price";

describe("servisPrice", () => {
  it("falls back to the estimate when the price column is still zero", () => {
    expect(servisPrice(0, 500_000)).toBe(500_000);
    expect(servisPrice(null, 500_000)).toBe(500_000);
  });

  it("prefers the real price when it is filled in", () => {
    expect(servisPrice(650_000, 500_000)).toBe(650_000);
  });

  it("returns zero when neither is set", () => {
    expect(servisPrice(0, null)).toBe(0);
    expect(servisPrice(null, undefined)).toBe(0);
  });
});
