import { describe, expect, it } from "vitest";
import { IMPORT_HEADERS, IMPORT_ROW_CAP, prepareInventoriImport, type InventoriImportRow } from "./import";

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

describe("template impor inventori", () => {
  it("tidak punya kolom tipe karena nama sheet menentukan tipe", () => {
    expect(IMPORT_HEADERS).not.toContain("tipe");
    const bekas = { ...base, tipe: undefined, _sheet: "Bekas", imei: "356938035412345", bh: "85" };
    const { products, errors } = prepareInventoriImport([bekas], []);
    expect(errors).toEqual([]);
    expect(products[0].variant_type).toBe("BEKAS");
  });
});

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
        bh_percent: null,
        garansi_days: null,
        kondisi_notes: null,
        parent_key: "iphone-14-pro",
      },
    ]);
  });

  it("memaksa stok unit bekas jadi 1, wajib IMEI 15 digit & BH", () => {
    const bekas = { ...base, tipe: "BEKAS", stok: "9", imei: "356938035412345", bh: "85", garansi_hari: "30", catatan: "Mulus" };
    const ok = prepareInventoriImport([bekas], []);
    expect(ok.errors).toEqual([]);
    expect(ok.products[0]).toMatchObject({ stock_qty: 1, bh_percent: 85, garansi_days: 30, kondisi_notes: "Mulus" });

    const badImei = prepareInventoriImport([{ ...bekas, imei: "123" }], []);
    expect(badImei.errors[0]).toContain("IMEI 15 digit");

    const badBh = prepareInventoriImport([{ ...bekas, bh: "" }], []);
    expect(badBh.errors[0]).toContain("BH");
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
