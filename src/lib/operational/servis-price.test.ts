import { describe, expect, it } from "vitest";
import { servisBill, servisOutstanding, servisPrice } from "./servis-price";

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

describe("servisBill", () => {
  it("memakai estimasi walau price sudah terisi total terbayar", () => {
    // price = 50.000 karena RPC menulis total terbayar, tagihannya tetap 100.000.
    expect(servisBill(50_000, 100_000)).toBe(100_000);
  });

  it("memakai price kalau estimasi kosong", () => {
    expect(servisBill(200_000, null)).toBe(200_000);
    expect(servisBill(200_000, 0)).toBe(200_000);
  });
});

describe("servisOutstanding", () => {
  it("menghitung sisa untuk DP dan lunas", () => {
    expect(servisOutstanding(100_000, 40_000)).toBe(60_000);
    expect(servisOutstanding(100_000, 100_000)).toBe(0);
    expect(servisOutstanding(100_000, 150_000)).toBe(0);
  });

  it("servis tanpa tagihan dianggap lunas supaya tetap bisa diambil", () => {
    expect(servisOutstanding(0, 0)).toBe(0);
  });
});
