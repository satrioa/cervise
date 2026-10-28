import { describe, expect, it } from "vitest";
import { IMPORT_ROW_CAP, prepareInventoriImport, type InventoriImportRow } from "./import";

const base: InventoriImportRow = {
  nama: "iPhone 14 Pro",
  sku: "gd-b-256-bl",
  kategori: "Gadget",
  tipe: "BARU",
  storage: "256 GB",
  warna: "Blue",
  stok: "3",
  modal: "15000000",
  jual: "17000000",
};

describe("prepareInventoriImport", () => {
  it("menormalkan SKU dan menyusun payload Baru", () => {
    const { products, errors } = prepareInventoriImport([base], []);
    expect(errors).toEqual([]);
    expect(products).toEqual([
      {
        name: "iPhone 14 Pro",
        sku: "GD-B-256-BL",
        category: "Gadget",
        variant_type: "BARU",
        storage: "256 GB",
        warna: "Blue",
        stock_qty: 3,
        cost: 15000000,
        price: 17000000,
        barcode: null,
        imei: null,
        kondisi_notes: null,
        parent_key: "iphone-14-pro",
      },
    ]);
  });

  it("memaksa stok unit bekas jadi 1 dan mewajibkan IMEI 15 digit", () => {
    const bekas = { ...base, tipe: "BEKAS", stok: "9", imei: "356938035412345" };
    const ok = prepareInventoriImport([bekas], []);
    expect(ok.errors).toEqual([]);
    expect(ok.products[0].stock_qty).toBe(1);

    const bad = prepareInventoriImport([{ ...bekas, imei: "123" }], []);
    expect(bad.errors[0]).toContain("IMEI 15 digit");
  });

  it("menolak SKU ganda, baik di file maupun di cabang", () => {
    const dupFile = prepareInventoriImport([base, { ...base, nama: "Lain" }], []);
    expect(dupFile.errors.some((error) => error.includes("ganda"))).toBe(true);

    const dupBranch = prepareInventoriImport([base], ["GD-B-256-BL"]);
    expect(dupBranch.products).toEqual([]);
    expect(dupBranch.errors.some((error) => error.includes("ganda"))).toBe(true);
  });

  it("menolak kategori/tipe tak dikenal dan stok negatif", () => {
    const { errors } = prepareInventoriImport(
      [
        { ...base, sku: "A", kategori: "Tablet" },
        { ...base, sku: "B", tipe: "REFURB" },
        { ...base, sku: "C", stok: "-2" },
      ],
      [],
    );
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("kategori");
    expect(errors[1]).toContain("tipe");
    expect(errors[2]).toContain("stok");
  });

  it("membatasi jumlah baris per impor", () => {
    const rows = Array.from({ length: IMPORT_ROW_CAP + 1 }, (_, index) => ({ ...base, sku: `SKU-${index}` }));
    expect(prepareInventoriImport(rows, []).errors[0]).toContain("Maksimal");
  });
});
