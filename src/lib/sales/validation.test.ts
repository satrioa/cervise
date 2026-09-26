import { describe, expect, it } from "vitest";
import { validateSaleItems } from "./validation";

const products = [
  { id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100 },
  { id: "product-2", name: "iPhone", stock_qty: 1, is_serialized: true, price: 1000 },
];

describe("sale item validation", () => {
  it("accepts valid in-stock items", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 2, unit_price: 120 }], products)).not.toThrow();
  });

  it("rejects non-positive, fractional, and non-finite values", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 0, unit_price: 120 }], products)).toThrow("Qty harus bilangan bulat > 0");
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 1.5, unit_price: 120 }], products)).toThrow("Qty harus bilangan bulat > 0");
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 1, unit_price: Number.NaN }], products)).toThrow("Harga harus valid");
  });

  it("rejects unknown, duplicate, and serialized stock violations", () => {
    expect(() => validateSaleItems([{ product_id: "missing", qty: 1, unit_price: 1 }], products)).toThrow("Produk tidak ditemukan");
    expect(() => validateSaleItems([
      { product_id: "product-1", qty: 1, unit_price: 1 },
      { product_id: "product-1", qty: 1, unit_price: 1 },
    ], products)).toThrow("Produk hanya boleh satu baris");
    expect(() => validateSaleItems([{ product_id: "product-2", qty: 2, unit_price: 1000 }], products)).toThrow("wajib qty 1");
    expect(() => validateSaleItems([{ product_id: "product-2", qty: 1, unit_price: 1000 }], products)).toThrow("IMEI wajib");
  });

  it("rejects quantities above available stock", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 6, unit_price: 120 }], products)).toThrow("tidak cukup");
  });
});
