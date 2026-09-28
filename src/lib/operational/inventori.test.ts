import { describe, expect, it } from "vitest";
import {
  groupInventoryProducts,
  inventoryGroupKey,
  normalizeInventorySlug,
  summarizeInventory,
  toInventoryTableRows,
  variantLabel,
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
