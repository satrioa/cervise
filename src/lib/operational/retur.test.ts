import { describe, expect, it } from "vitest";
import { perkiraanRefund } from "./retur";

const sale = (patch: Partial<{ subtotal: number; total: number; paid: number; returnedValue: number }> = {}) => ({
  subtotal: 300_000,
  total: 300_000,
  paid: 300_000,
  returnedValue: 0,
  ...patch,
});

describe("perkiraanRefund", () => {
  it("mengembalikan harga barang saat tidak ada diskon", () => {
    expect(
      perkiraanRefund(sale(), [{ qty: 2, qtyReturned: 1, unitPrice: 150_000 }]),
    ).toBe(150_000);
  });

  it("memakai total setelah diskon, bukan harga sticker", () => {
    // 2 unit @150.000 dengan diskon 100.000: pelanggan membayar 200.000.
    // Retur 1 unit hanya boleh 100.000, bukan 150.000.
    const diskon = sale({ subtotal: 300_000, total: 200_000, paid: 200_000 });
    expect(
      perkiraanRefund(diskon, [{ qty: 2, qtyReturned: 1, unitPrice: 150_000 }]),
    ).toBe(100_000);
  });

  it("tidak mengembalikan uang lebih dari yang pernah diterima (DP)", () => {
    // Total 300.000, baru dibayar 100.000, semua barang kembali.
    const dp = sale({ paid: 100_000 });
    expect(
      perkiraanRefund(dp, [{ qty: 2, qtyReturned: 2, unitPrice: 150_000 }]),
    ).toBe(100_000);
  });

  it("mengembalikan tepat sisa saat semua item kembali, tanpa sisa pembulatan", () => {
    // 3 item, total 1.000.000 dari subtotal 1.200.000 (diskon 200.000).
    // floor per item akan menyisakan 1 rupiah; cabang 'semua kembali' menutupnya.
    const s = sale({ subtotal: 1_200_000, total: 1_000_000, paid: 1_000_000 });
    expect(
      perkiraanRefund(s, [{ qty: 3, qtyReturned: 3, unitPrice: 400_000 }]),
    ).toBe(1_000_000);
  });

  it("hanya menghitung selisih terhadap retur sebelumnya", () => {
    const sudahRetur = sale({ returnedValue: 150_000 });
    expect(
      perkiraanRefund(sudahRetur, [{ qty: 2, qtyReturned: 2, unitPrice: 150_000 }]),
    ).toBe(150_000);
  });

  it("tidak memberi refund kalau tidak ada yang diretur", () => {
    expect(
      perkiraanRefund(sale(), [{ qty: 2, qtyReturned: 0, unitPrice: 150_000 }]),
    ).toBe(0);
  });
});
