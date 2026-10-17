import { describe, expect, it } from "vitest";
import {
  filterInventoryGroups,
  groupInventoryProducts,
  inventoryGroupKey,
  normalizeInventorySlug,
  summarizeInventory,
  toInventoryTableRows,
  variantLabel,
  STOCK_MENIPIS_MAX,
  type InventoryProduct,
} from "@/lib/operational/inventori";

function product(partial: Partial<InventoryProduct> & { id: string; name: string }): InventoryProduct {
  return {
    sku: `SKU-${partial.id}`,
    category: "Gadget",
    stock_qty: 1,
    cost: 1000,
    price: 2000,
    variant_type: "BARU",
    storage: null,
    warna: null,
    bh_percent: null,
    kondisi_notes: null,
    garansi_days: null,
    imei: null,
    parent_key: null,
    ...partial,
  };
}

describe("normalizeInventorySlug", () => {
  it("lowercases and collapses non-alphanumeric runs", () => {
    expect(normalizeInventorySlug("iPhone 13 Pro Max")).toBe("iphone-13-pro-max");
    expect(normalizeInventorySlug("  OPPO   Reno5  ")).toBe("oppo-reno5");
  });

  it("trims leading and trailing dashes", () => {
    expect(normalizeInventorySlug("!!! Redmi Note 11 !!!")).toBe("redmi-note-11");
  });
});

describe("inventoryGroupKey", () => {
  it("uses parent_key when present so variants land under the same parent", () => {
    expect(inventoryGroupKey({ name: "iPhone 13 128GB Hitam", parent_key: "iphone-13" })).toBe("iphone-13");
  });

  it("falls back to the name slug when there is no parent_key", () => {
    expect(inventoryGroupKey({ name: "iPhone 13", parent_key: null })).toBe("iphone-13");
  });

  it("ignores whitespace-only parent_key instead of producing an empty key", () => {
    expect(inventoryGroupKey({ name: "Kabel USB-C", parent_key: "   " })).toBe("kabel-usb-c");
  });
});

describe("groupInventoryProducts", () => {
  it("groups all variants of a parent under one key", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "iPhone 13 128GB", parent_key: "iphone-13", stock_qty: 3 }),
      product({ id: "2", name: "iPhone 13 256GB", parent_key: "iphone-13", stock_qty: 2 }),
      product({ id: "3", name: "Kabel USB-C", stock_qty: 10 }),
    ]);

    expect(groups).toHaveLength(2);
    const parent = groups.find((group) => group.key === "iphone-13")!;
    expect(parent.items).toHaveLength(2);
    expect(parent.totalStok).toBe(5);
  });

  it("splits variants into baru and bekas", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "iPhone 13", parent_key: "iphone-13", variant_type: "BARU", stock_qty: 4 }),
      product({
        id: "2",
        name: "iPhone 13",
        parent_key: "iphone-13",
        variant_type: "BEKAS",
        imei: "352099001111111",
        stock_qty: 1,
      }),
      product({
        id: "3",
        name: "iPhone 13",
        parent_key: "iphone-13",
        variant_type: "BEKAS",
        imei: "352099002222222",
        stock_qty: 0,
      }),
    ]);

    const parent = groups[0];
    expect(parent.baru).toHaveLength(1);
    expect(parent.bekas).toHaveLength(2);
    // Bekas tersedia hanya yang stock_qty > 0.
    expect(parent.bekasTersedia).toBe(1);
    expect(parent.totalStok).toBe(5);
  });

  it("counts sold-out variants so the UI can flag them", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "iPhone 13", parent_key: "iphone-13", stock_qty: 0 }),
      product({ id: "2", name: "iPhone 13", parent_key: "iphone-13", stock_qty: 2 }),
    ]);
    expect(groups[0].stokHabis).toBe(1);
  });

  it("treats null stock_qty as zero instead of NaN", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "Sparepart", parent_key: "sparepart", stock_qty: null }),
      product({ id: "2", name: "Sparepart 2", parent_key: "sparepart", stock_qty: 3 }),
    ]);
    expect(groups[0].totalStok).toBe(3);
    expect(Number.isNaN(groups[0].totalStok)).toBe(false);
  });

  it("collapses case differences in names when there is no parent_key", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "Kabel USB-C" }),
      product({ id: "2", name: "kabel usb c" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it("returns an empty list for no products", () => {
    expect(groupInventoryProducts([])).toEqual([]);
  });

  it("keeps a lone variant as its own group", () => {
    const groups = groupInventoryProducts([product({ id: "1", name: "Charger 20W" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("charger-20w");
  });
});

describe("summarizeInventory", () => {
  it("counts groups, variants, and stock across all groups", () => {
    const groups = groupInventoryProducts([
      product({ id: "1", name: "iPhone 13", parent_key: "iphone-13", variant_type: "BARU", stock_qty: 3 }),
      product({ id: "2", name: "iPhone 13 256", parent_key: "iphone-13", variant_type: "BEKAS", stock_qty: 1 }),
      product({ id: "3", name: "Kabel USB-C", variant_type: "BARU", stock_qty: 0 }),
    ]);

    expect(summarizeInventory(groups)).toEqual({
      groups: 2,
      varian: 3,
      baru: 2,
      bekas: 1,
      totalStok: 4,
      stokHabis: 1,
    });
  });
});

describe("toInventoryTableRows", () => {
  const groups = groupInventoryProducts([
    product({ id: "1", name: "iPhone 13 128", parent_key: "iphone-13", stock_qty: 2 }),
    product({ id: "2", name: "iPhone 13 256", parent_key: "iphone-13", stock_qty: 1 }),
    product({ id: "3", name: "Kabel USB-C", stock_qty: 5 }),
  ]);

  it("hides child rows of a collapsed multi-variant group", () => {
    const rows = toInventoryTableRows(groups, new Set());
    // 2 parent row: varian iphone-13 tersembunyi, sedangkan group
    // "Kabel USB-C" tetap terbuka karena cuma punya satu varian.
    expect(rows).toHaveLength(3);
    const children = rows.filter((row) => row.kind === "child");
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ product: { id: "3" } });
  });

  it("reveals child rows when the parent is expanded", () => {
    const rows = toInventoryTableRows(groups, new Set(["iphone-13"]));
    expect(rows).toHaveLength(5);
    const children = rows.filter((row) => row.kind === "child");
    expect(children).toHaveLength(3);
  });

  it("auto-expands a single-variant group so it is never hidden behind a click", () => {
    const rows = toInventoryTableRows(groups, new Set());
    const single = rows.find((row) => row.kind === "parent" && row.group.key === "kabel-usb-c")!;
    const after = rows[rows.indexOf(single) + 1];
    expect(after).toMatchObject({ kind: "child" });
  });

  it("places child rows directly after their own parent, not at the end", () => {
    const rows = toInventoryTableRows(groups, new Set(["kabel-usb-c"]));
    const childIndex = rows.findIndex((row) => row.kind === "child" && row.product.id === "3");
    expect(rows[childIndex - 1]).toMatchObject({ kind: "parent", group: { key: "kabel-usb-c" } });
  });
});

describe("variantLabel", () => {
  it("puts IMEI first for used units", () => {
    expect(
      variantLabel({ variant_type: "BEKAS", storage: "128GB", warna: "Hitam", imei: "352099001111111" }),
    ).toBe("352099001111111 · 128GB · Hitam");
  });

  it("omits IMEI for new units", () => {
    expect(variantLabel({ variant_type: "BARU", storage: "256GB", warna: "Biru", imei: "999" })).toBe(
      "256GB · Biru",
    );
  });

  it("returns an em dash instead of empty text when nothing is known", () => {
    expect(variantLabel({ variant_type: "BARU", storage: null, warna: null, imei: null })).toBe("—");
  });

  it("skips blank-string values rather than rendering double separators", () => {
    expect(variantLabel({ variant_type: "BARU", storage: "  ", warna: "Hitam", imei: null })).toBe("Hitam");
  });
});

describe("filterInventoryGroups", () => {
  const groups = groupInventoryProducts([
    product({ id: "1", name: "iPhone 13 128GB Hitam", parent_key: "iphone-13", sku: "IP13-128", storage: "128GB", warna: "Hitam", stock_qty: 5 }),
    product({ id: "2", name: "iPhone 13 128GB Putih", parent_key: "iphone-13", sku: "IP13-128P", storage: "128GB", warna: "Putih", stock_qty: 0 }),
    product({ id: "3", name: "iPhone 13 64GB", parent_key: "iphone-13", sku: "IP13-64", storage: "64GB", stock_qty: 2 }),
    product({ id: "4", name: "Kabel USB-C", sku: "CBL-C", barcode: "8991234567", stock_qty: 10 }),
    product({
      id: "5",
      name: "iPhone 12",
      parent_key: "iphone-12",
      sku: "IP12-128",
      variant_type: "BEKAS",
      imei: "352099001111111",
      stock_qty: 1,
    }),
  ]);

  it("returns the same array reference when nothing is filtered", () => {
    // Identitas, bukan kesamaan: filter tanpa kriteria tidak boleh membangun
    // ulang group, karena itu membuang memo `useMemo` di client.
    expect(filterInventoryGroups(groups, {})).toBe(groups);
    expect(filterInventoryGroups(groups, { q: "   ", tipe: "semua", stok: "semua" })).toBe(groups);
  });

  it("matches the group name and keeps every variant of that group", () => {
    // Mencari "iPhone 13" harus memunculkan semua varian, bukan hanya varian
    // yang namanya mengandung frasa itu persis.
    const filtered = filterInventoryGroups(groups, { q: "iphone 13" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe("iphone-13");
    expect(filtered[0].items).toHaveLength(3);
  });

  it("is case-insensitive and trims the query", () => {
    expect(filterInventoryGroups(groups, { q: "  IPHONE 13  " })).toHaveLength(1);
  });

  it("matches SKU, barcode, IMEI, and colour, not just the name", () => {
    expect(filterInventoryGroups(groups, { q: "CBL-C" })[0].key).toBe("kabel-usb-c");
    expect(filterInventoryGroups(groups, { q: "8991234567" })[0].key).toBe("kabel-usb-c");
    expect(filterInventoryGroups(groups, { q: "352099001111111" })[0].key).toBe("iphone-12");
    // "Putih" hanya ada di satu varian iPhone 13, jadi grupnya tetap muncul
    // tapi hanya varian itu yang lolos.
    const putih = filterInventoryGroups(groups, { q: "Putih" });
    expect(putih[0].items).toHaveLength(1);
    expect(putih[0].items[0].warna).toBe("Putih");
  });

  it("drops a group whose variants are all filtered out", () => {
    expect(filterInventoryGroups(groups, { q: "tidak-ada-ini" })).toEqual([]);
  });

  it("filters by tipe and rebuilds the group counts", () => {
    const bekas = filterInventoryGroups(groups, { tipe: "BEKAS" });
    expect(bekas).toHaveLength(1);
    expect(bekas[0].bekas).toHaveLength(1);
    expect(bekas[0].baru).toHaveLength(0);
    expect(bekas[0].totalStok).toBe(1);
  });

  it("recomputes totalStok so the parent row matches what is shown", () => {
    // Ini bug yang paling mudah tidak terlihat: kalau hanya `items` yang
    // dipotong tanpa dihitung ulang, baris induk masih ditulis 7 padahal
    // tabelnya cuma menampilkan 5.
    const habis = filterInventoryGroups(groups, { q: "iphone 13", stok: "habis" });
    expect(habis[0].items).toHaveLength(1);
    expect(habis[0].totalStok).toBe(0);
    expect(habis[0].stokHabis).toBe(1);
  });

  it("uses the same stock thresholds as the badge", () => {
    const habis = filterInventoryGroups(groups, { stok: "habis" });
    expect(habis[0].items.every((item) => (item.stock_qty ?? 0) <= 0)).toBe(true);

    const menipis = filterInventoryGroups(groups, { stok: "menipis" });
    expect(menipis[0].items.map((item) => item.stock_qty)).toEqual([2]);

    const tersedia = filterInventoryGroups(groups, { stok: "tersedia" });
    expect(tersedia.flatMap((group) => group.items).every((item) => (item.stock_qty ?? 0) >= STOCK_MENIPIS_MAX)).toBe(true);
  });

  it("treats null stock as zero, so it lands in 'habis'", () => {
    const denganNull = groupInventoryProducts([
      product({ id: "9", name: "Sparepart Tanpa Stok", sku: "NOSTOCK", stock_qty: null }),
    ]);
    expect(filterInventoryGroups(denganNull, { stok: "habis" })).toHaveLength(1);
  });

  it("combines tipe and stok instead of treating them as alternatives", () => {
    const hasil = filterInventoryGroups(groups, { tipe: "BARU", stok: "tersedia" });
    expect(hasil).toHaveLength(2);
    expect(hasil.every((group) => group.items.every((item) => item.variant_type === "BARU"))).toBe(true);
  });

  it("preserves the original group key so expand state survives filtering", () => {
    // `TableView` menyimpan state expand per `group.key`; kalau key berubah
    // saat difilter, baris yang tadinya terbuka akan menutup sendiri.
    const filtered = filterInventoryGroups(groups, { q: "iphone 13" });
    expect(filtered[0].key).toBe(groups.find((group) => group.key === "iphone-13")!.key);
  });

  it("does not mutate the input groups", () => {
    const before = groups[0].items.length;
    filterInventoryGroups(groups, { tipe: "BEKAS" });
    expect(groups[0].items).toHaveLength(before);
    expect(groups[0].totalStok).toBe(7);
  });

  it("keeps a table row for every group it returns", () => {
    // Baris induk harus selalu punya anak yang menyusulnya, kalau tidak
    // chevron expand dangling.
    const filtered = filterInventoryGroups(groups, { stok: "habis" });
    const rows = toInventoryTableRows(filtered, new Set());
    expect(rows.filter((row) => row.kind === "parent")).toHaveLength(filtered.length);
  });
});
