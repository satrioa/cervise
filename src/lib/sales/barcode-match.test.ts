import { describe, expect, it } from "vitest";
import { matchProductByCode } from "./barcode-match";

const products = [
  { id: "a", sku: "SKU-001", barcode: "899123" },
  { id: "b", sku: "SKU-002", barcode: null },
  { id: "c", sku: "899123X", barcode: "" },
];

describe("matchProductByCode", () => {
  it("mencocokkan barcode persis", () => {
    expect(matchProductByCode(products, "899123")?.id).toBe("a");
  });

  it("tidak peduli huruf besar/kecil dan spasi", () => {
    expect(matchProductByCode(products, "  899123 ")?.id).toBe("a");
    expect(matchProductByCode(products, "sku-002")?.id).toBe("b");
    expect(matchProductByCode(products, "Sku-002")?.id).toBe("b");
  });

  it("jatuh ke SKU kalau barcode tidak ketemu", () => {
    expect(matchProductByCode(products, "SKU-002")?.id).toBe("b");
    // "899123X" adalah SKU produk c, bukan barcode — harus tetap ketemu.
    expect(matchProductByCode(products, "899123x")?.id).toBe("c");
  });

  it("barcode diutamakan daripada SKU", () => {
    const both = [
      { id: "sku", sku: "111" },
      { id: "barcode", sku: "999", barcode: "111" },
    ];
    expect(matchProductByCode(both, "111")?.id).toBe("barcode");
  });

  it("mengembalikan null untuk kode kosong atau tidak dikenal", () => {
    expect(matchProductByCode(products, "")).toBeNull();
    expect(matchProductByCode(products, "   ")).toBeNull();
    expect(matchProductByCode(products, "tidak-ada")).toBeNull();
  });
});
