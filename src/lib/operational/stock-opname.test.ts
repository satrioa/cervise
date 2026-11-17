import { describe, expect, it } from "vitest";
import type { InventoryProduct } from "./inventori";
import {
  buildProductSnapshot,
  buildSparepartSnapshot,
  computeVariance,
  summarize,
  toXlsxRows,
} from "./stock-opname";

function product(overrides: Partial<InventoryProduct>): InventoryProduct {
  return {
    id: "p", name: "Produk", sku: "SKU", category: null, stock_qty: 0,
    cost: 10, price: 20, variant_type: "BARU", storage: null, warna: null,
    bh_percent: null, kondisi_notes: null, garansi_days: null, imei: null,
    parent_key: null, ...overrides,
  };
}

describe("stock opname snapshot", () => {
  it("makes one line per IMEI for BEKAS and one aggregate line for BARU", () => {
    const lines = buildProductSnapshot([
      product({ id: "b1", variant_type: "BEKAS", imei: "111", stock_qty: 1 }),
      product({ id: "b2", variant_type: "BEKAS", imei: "222", stock_qty: 1 }),
      product({ id: "n1", variant_type: "BARU", stock_qty: 5 }),
    ]);
    expect(lines.filter((l) => l.imei)).toHaveLength(2);
    expect(lines.find((l) => l.refId === "n1")?.snapshotQty).toBe(5);
    expect(lines.find((l) => l.imei === "111")?.snapshotQty).toBe(1);
  });

  it("falls back to an aggregate BEKAS line when IMEI is missing", () => {
    const lines = buildProductSnapshot([product({ id: "b3", variant_type: "BEKAS", stock_qty: 2 })]);
    expect(lines).toEqual([
      expect.objectContaining({ refId: "b3", imei: null, snapshotQty: 2 }),
    ]);
  });

  it("builds sparepart lines with their stock as snapshot", () => {
    const lines = buildSparepartSnapshot([
      { id: "s1", sku: "SP1", name: "Sparepart", stock_qty: 7, cost: 3 },
    ]);
    expect(lines[0]).toEqual(expect.objectContaining({ refId: "s1", snapshotQty: 7, cost: 3 }));
  });
});

describe("stock opname variance", () => {
  const lines = [
    { refId: "a", sku: "A", name: "A", imei: null, snapshotQty: 5, countedQty: 3, cost: 10 },
    { refId: "b", sku: "B", name: "B", imei: null, snapshotQty: 2, countedQty: 4, cost: 7 },
  ];

  it("computes signed variance", () => {
    expect(computeVariance(lines[0])).toBe(-2);
    expect(computeVariance(lines[1])).toBe(2);
  });

  it("summarizes counted, matched, shortage, surplus, and variance value", () => {
    expect(summarize(lines)).toEqual({
      total: 2, counted: 2, matched: 0, shortage: 1, surplus: 1, varianceValue: -6,
    });
  });

  it("exports summary-friendly XLSX rows with variance text", () => {
    const rows = toXlsxRows(lines, { id: "sesi", domain: "product" } as any);
    expect(rows[0]["Selisih"]).toBe(-2);
    expect(rows[0]["Kode"]).toBe("A");
  });
});
