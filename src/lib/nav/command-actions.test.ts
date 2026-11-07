import { describe, expect, it } from "vitest";
import {
  commandSearchTerm,
  matchCustomers,
  matchProducts,
  matchQuickActions,
  wantsProductSuggestions,
} from "@/lib/nav/command-actions";

describe("command palette matching", () => {
  it("mengenali niat stok hanya untuk perintah yang tepat", () => {
    expect(wantsProductSuggestions("tambah stok")).toBe(true);
    expect(wantsProductSuggestions("tambah stok iphone")).toBe(true);
    expect(wantsProductSuggestions("stok menipis")).toBe(true);
    expect(wantsProductSuggestions("tambah iphone")).toBe(true);
    expect(wantsProductSuggestions("tambah servis")).toBe(false);
    expect(wantsProductSuggestions("cari customer budi")).toBe(false);
  });

  it("membuang kata perintah dari kata kunci pencarian", () => {
    expect(commandSearchTerm("tambah stok iPhone 13")).toBe("iphone 13");
    expect(commandSearchTerm("cari customer Budi")).toBe("budi");
    expect(commandSearchTerm("cari produk SKU-1")).toBe("sku-1");
  });

  it("mencocokkan nama maupun SKU dan memotong hasil jadi 3", () => {
    const products = [
      { id: "1", name: "iPhone 13", sku: "GD-13" },
      { id: "2", name: "iPhone 14", sku: "GD-14" },
      { id: "3", name: "iPhone 15", sku: "GD-15" },
      { id: "4", name: "Samsung S24", sku: "GD-24" },
    ];
    expect(matchProducts(products, "tambah stok iphone")).toHaveLength(3);
    expect(matchProducts(products, "tambah stok GD-24").map((p) => p.id)).toEqual(["4"]);
  });

  it("mencocokkan nomor HP customer dan memotong hasil jadi 3", () => {
    const customers = [
      { id: "1", name: "Budi", phone: "628111" },
      { id: "2", name: "Budi Santoso", phone: "628222" },
      { id: "3", name: "Budi Lain", phone: "628333" },
      { id: "4", name: "Siti", phone: "628444" },
    ];
    expect(matchCustomers(customers, "cari customer budi")).toHaveLength(3);
    expect(matchCustomers(customers, "cari customer 8444").map((c) => c.id)).toEqual(["4"]);
  });

  it("menampilkan maksimal 3 aksi untuk kata kunci 'tambah'", () => {
    const actions = [
      { id: "servis", label: "Tambah data servis", keywords: "tambah baru buat servis" },
      { id: "stok", label: "Tambah stok produk", keywords: "tambah stok produk" },
      { id: "karyawan", label: "Tambah data karyawan", keywords: "tambah baru buat karyawan" },
      { id: "customer", label: "Tambah customer", keywords: "tambah customer pelanggan" },
    ];
    expect(matchQuickActions(actions, "tambah").map((a) => a.id)).toEqual([
      "servis",
      "stok",
      "karyawan",
    ]);
    expect(matchQuickActions(actions, "tambah customer").map((a) => a.id)).toEqual(["customer"]);
  });
});
