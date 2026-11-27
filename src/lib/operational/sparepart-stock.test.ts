import { describe, expect, it } from "vitest";
import { lowStockRows, summarizeSparepartStock } from "./sparepart-stock";

const rows = [
  { name: "Habis", stock_qty: 0, low_stock_threshold: 5 },
  { name: "Menipis pas", stock_qty: 5, low_stock_threshold: 5 },
  { name: "Menipis", stock_qty: 2, low_stock_threshold: 5 },
  { name: "Aman", stock_qty: 6, low_stock_threshold: 5 },
  { name: "Threshold ketat", stock_qty: 9, low_stock_threshold: 10 },
];

describe("summarizeSparepartStock", () => {
  it("menghitung ringkasan KPI", () => {
    expect(summarizeSparepartStock(rows)).toEqual({
      totalJenis: 5,
      totalUnit: 22,
      habis: 1,
      menipis: 3,
    });
  });

  it("tabel kosong menghasilkan nol", () => {
    expect(summarizeSparepartStock([])).toEqual({
      totalJenis: 0,
      totalUnit: 0,
      habis: 0,
      menipis: 0,
    });
  });

  it("baris tanpa threshold memakai default 5", () => {
    const result = summarizeSparepartStock([
      { name: "Tanpa threshold", stock_qty: 4 },
    ]);
    expect(result.menipis).toBe(1);
  });
});

describe("lowStockRows", () => {
  it("hanya mengembalikan baris dengan stok <= threshold", () => {
    expect(lowStockRows(rows).map((row) => row.name)).toEqual([
      "Habis",
      "Menipis pas",
      "Menipis",
      "Threshold ketat",
    ]);
  });

  it("tidak mengembalikan apa pun bila semua aman", () => {
    expect(lowStockRows([rows[3]])).toEqual([]);
  });
});
