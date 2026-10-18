import { describe, expect, it } from "vitest";
import { validateSaleItems } from "./validation";

const products = [
  { id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, imei: null },
  { id: "product-2", name: "iPhone", stock_qty: 1, is_serialized: true, price: 1000, imei: "356938035412345" },
  { id: "product-3", name: "Bekas", stock_qty: 1, is_serialized: true, price: 500, imei: null },
];

const bolehUbah = { canOverridePrice: true };
const tidakBolehUbah = { canOverridePrice: false };

describe("sale item validation", () => {
  it("accepts valid in-stock items", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 2, unit_price: 120 }], products, bolehUbah)).not.toThrow();
  });

  it("rejects non-positive, fractional, and non-finite values", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 0, unit_price: 120 }], products, bolehUbah)).toThrow("Qty harus bilangan bulat > 0");
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 1.5, unit_price: 120 }], products, bolehUbah)).toThrow("Qty harus bilangan bulat > 0");
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 1, unit_price: Number.NaN }], products, bolehUbah)).toThrow("Harga harus valid");
  });

  it("rejects unknown, duplicate, and serialized stock violations", () => {
    expect(() => validateSaleItems([{ product_id: "missing", qty: 1, unit_price: 1 }], products, bolehUbah)).toThrow("Produk tidak ditemukan");
    expect(() => validateSaleItems([
      { product_id: "product-1", qty: 1, unit_price: 1 },
      { product_id: "product-1", qty: 1, unit_price: 1 },
    ], products, bolehUbah)).toThrow("Produk hanya boleh satu baris");
    expect(() => validateSaleItems([{ product_id: "product-2", qty: 2, unit_price: 1000 }], products, bolehUbah)).toThrow("wajib qty 1");
    expect(() => validateSaleItems([{ product_id: "product-2", qty: 1, unit_price: 1000 }], products, bolehUbah)).toThrow("IMEI wajib");
  });

  it("rejects quantities above available stock", () => {
    expect(() => validateSaleItems([{ product_id: "product-1", qty: 6, unit_price: 120 }], products, bolehUbah)).toThrow("tidak cukup");
  });

  describe("harga yang tidak boleh diubah role ini", () => {
    // Bug yang diuji: harga Rp 100.000 diubah jadi Rp 1, layar menampilkan
    // "Total Rp1", server menyimpan total Rp 100.000. Uang Rp 1 yang benar-benar
    // diterima hilang dari laci.
    it("menolak harga yang berbeda dari harga produk", () => {
      expect(() =>
        validateSaleItems([{ product_id: "product-1", qty: 1, unit_price: 1 }], products, tidakBolehUbah),
      ).toThrow("tidak boleh diubah");
    });

    it("meneruskan harga produk apa adanya", () => {
      expect(() =>
        validateSaleItems([{ product_id: "product-1", qty: 2, unit_price: 100 }], products, tidakBolehUbah),
      ).not.toThrow();
    });

    it("tetap mengizinkan role yang punya hak harga_jual", () => {
      expect(() =>
        validateSaleItems([{ product_id: "product-1", qty: 1, unit_price: 1 }], products, bolehUbah),
      ).not.toThrow();
    });
  });

  describe("IMEI harus milik unit yang dijual", () => {
    // Bug yang diuji: barang BEKAS dengan imei 356938035412345 bisa terjual
    // dengan imei1 "356938035412999". Penjualan dan pencarian garansi lalu
    // membawa IMEI perangkat lain.
    it("menolak IMEI yang bukan milik produk itu", () => {
      expect(() =>
        validateSaleItems(
          [{ product_id: "product-2", qty: 1, unit_price: 1000, imei1: "356938035412999" }],
          products,
          bolehUbah,
        ),
      ).toThrow("harus 356938035412345");
    });

    it("meneruskan IMEI yang cocok", () => {
      expect(() =>
        validateSaleItems(
          [{ product_id: "product-2", qty: 1, unit_price: 1000, imei1: "356938035412345" }],
          products,
          bolehUbah,
        ),
      ).not.toThrow();
    });

    it("tidak menolak kalau produknya tidak punya IMEI sendiri", () => {
      expect(() =>
        validateSaleItems(
          [{ product_id: "product-3", qty: 1, unit_price: 500, imei1: "apa saja" }],
          products,
          bolehUbah,
        ),
      ).not.toThrow();
    });
  });
});