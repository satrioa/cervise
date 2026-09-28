/**
 * Pengelompokan produk inventori menjadi produk induk + varian.
 *
 * Fungsi-fungsi di file ini murni (tanpa Supabase/React) supaya aturan
 * pengelompokannya bisa diuji langsung. Halaman inventori sebelumnya
 * melakukan grouping inline di server component dengan `as any`, sehingga
 * tidak ada yang memverifikasi bahwa varian benar-benar menempel ke induknya.
 *
 * Aturan:
 * - Varian yang punya `parent_key` menempel ke key itu, apa pun namanya.
 * - Varian tanpa `parent_key` menjadi induk sendiri, dengan key dari slug nama.
 * - Slug dinormalisasi (lowercase, non-alnum jadi "-") supaya "iPhone 13" dan
 *   "iphone 13" collapse ke satu group.
 */

export type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string | null;
  stock_qty: number | null;
  cost: number | null;
  price: number | null;
  variant_type: "BARU" | "BEKAS" | null;
  storage: string | null;
  warna: string | null;
  bh_percent: number | null;
  kondisi_notes: string | null;
  garansi_days: number | null;
  imei: string | null;
  parent_key: string | null;
  is_active?: boolean;
};

export type InventoryGroup = {
  key: string;
  name: string;
  items: InventoryProduct[];
  baru: InventoryProduct[];
  bekas: InventoryProduct[];
  totalStok: number;
  /** Unit bekas yang masih bisa dijual (stock_qty > 0). */
  bekasTersedia: number;
  /** Varian yang tidak bisa dijual karena stok habis. */
  stokHabis: number;
};

export function normalizeInventorySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Kunci group untuk satu produk. Varian yang menyebut parent_key mengikuti key
 * itu, apa pun nama produknya.
 */
export function inventoryGroupKey(product: Pick<InventoryProduct, "name" | "parent_key">): string {
  const parent = product.parent_key?.trim();
  if (parent) return parent;
  const slug = normalizeInventorySlug(product.name);
  return slug || `row-${product.name}`;
}

export function groupInventoryProducts(products: InventoryProduct[]): InventoryGroup[] {
  const groups = new Map<string, InventoryProduct[]>();

  for (const product of products) {
    const key = inventoryGroupKey(product);
    const bucket = groups.get(key);
    if (bucket) bucket.push(product);
    else groups.set(key, [product]);
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const baru = items.filter((item) => item.variant_type === "BARU");
    const bekas = items.filter((item) => item.variant_type === "BEKAS");
    return {
      key,
      // Nama induk: data tidak punya tabel produk terpisah, jadi nama varian
      // pertama adalah satu-satunya sumber yang jujur untuk ditampilkan.
      name: items[0].name,
      items,
      baru,
      bekas,
      totalStok: items.reduce((sum, item) => sum + (item.stock_qty ?? 0), 0),
      bekasTersedia: bekas.filter((item) => (item.stock_qty ?? 0) > 0).length,
      stokHabis: items.filter((item) => (item.stock_qty ?? 0) <= 0).length,
    };
  });
}

export type InventorySummary = {
  groups: number;
  varian: number;
  baru: number;
  bekas: number;
  totalStok: number;
  stokHabis: number;
};

export function summarizeInventory(groups: InventoryGroup[]): InventorySummary {
  const items = groups.flatMap((group) => group.items);
  return {
    groups: groups.length,
    varian: items.length,
    baru: items.filter((item) => item.variant_type === "BARU").length,
    bekas: items.filter((item) => item.variant_type === "BEKAS").length,
    totalStok: items.reduce((sum, item) => sum + (item.stock_qty ?? 0), 0),
    stokHabis: items.filter((item) => (item.stock_qty ?? 0) <= 0).length,
  };
}

/** Baris tabel yang sudah diratakan: parent row + child variant rows. */
export type InventoryTableRow =
  | { kind: "parent"; group: InventoryGroup }
  | { kind: "child"; group: InventoryGroup; product: InventoryProduct };

/**
 * Ratakan group menjadi baris tabel dengan anak yang menyusul induknya. Parent
 * hanya di-collapse kalau group-nya punya lebih dari satu varian, supaya
 * produk tunggal tetap terbaca tanpa perlu diklik.
 */
export function toInventoryTableRows(
  groups: InventoryGroup[],
  expanded: ReadonlySet<string>,
): InventoryTableRow[] {
  const rows: InventoryTableRow[] = [];
  for (const group of groups) {
    rows.push({ kind: "parent", group });
    if (expanded.has(group.key) || group.items.length === 1) {
      for (const product of group.items) rows.push({ kind: "child", group, product });
    }
  }
  return rows;
}

/** Label varian yang jujur: storage/warna boleh kosong, IMEI hanya untuk bekas. */
export function variantLabel(product: Pick<InventoryProduct, "variant_type" | "storage" | "warna" | "imei">): string {
  const parts = [product.storage, product.warna].filter((part): part is string => Boolean(part && part.trim()));
  if (product.variant_type === "BEKAS" && product.imei) parts.unshift(product.imei);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
