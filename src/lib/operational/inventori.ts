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

  return Array.from(groups.entries()).map(([key, items]) => buildInventoryGroup(key, items));
}

/**
 * Susun angka turunan sebuah group dari daftar variannya.
 *
 * Dipisah dari `groupInventoryProducts` supaya hasil filter bisa membangun ulang
 * group dengan hitungan yang sama persis. Kalau filter hanya memotong `items`
 * tanpa menghitung ulang `totalStok`/`baru`/`bekas`, baris induk di tabel
 * akan menampilkan angka dari katalog penuh - bukan dari yang sedang dilihat.
 */
function buildInventoryGroup(key: string, items: InventoryProduct[]): InventoryGroup {
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

/* ---------------------------------------------------------------- filter --- */

/** Ambang stok; dipakai bersama badge di tabel supaya warna dan filter agree. */
export const STOCK_HABIS_MAX = 0;
export const STOCK_MENIPIS_MAX = 3;

export const INVENTORI_DEFAULTS = { q: "", tipe: "semua", stok: "semua" } as const;

/** Kriteria filter inventori. String, bukan union ketat, karena nilainya datang dari query string. */
export type InventoryFilter = {
  /** Dicocokkan ke nama, SKU, barcode, IMEI, storage, dan warna. */
  q?: string;
  /** "semua" | "BARU" | "BEKAS" */
  tipe?: string;
  /** "semua" | "habis" | "menipis" | "tersedia" */
  stok?: string;
};

export const TIPE_OPTIONS = [
  { label: "Semua tipe", value: "semua" },
  { label: "Baru", value: "BARU" },
  { label: "Bekas", value: "BEKAS" },
] as const;

export const STOK_OPTIONS = [
  { label: "Semua stok", value: "semua" },
  { label: "Stok habis", value: "habis" },
  { label: "Stok menipis", value: "menipis" },
  { label: "Stok tersedia", value: "tersedia" },
] as const;

function matchesStock(stock: number, stok: string): boolean {
  if (stok === "habis") return stock <= STOCK_HABIS_MAX;
  if (stok === "menipis") return stock > STOCK_HABIS_MAX && stock < STOCK_MENIPIS_MAX;
  if (stok === "tersedia") return stock >= STOCK_MENIPIS_MAX;
  return true;
}

/** Apakah satu varian lolos pencarian teks. */
function matchesQuery(product: InventoryProduct, needle: string): boolean {
  const haystack = [product.name, product.sku, product.barcode, product.imei, product.storage, product.warna]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Saring group inventori.
 *
 * Varian yang cocok tetap dikelompokkan dengan induknya, jadi baris induk di
 * tabel tidak pernah menggantung tanpa anak. Kalau seluruh varian sebuah group
 * tersaring habis, group-nya ikut hilang - tidak ada gunanya menampilkan
 * induk yang isinya nol.
 *
 * Group dibangun ulang lewat `buildInventoryGroup`, bukan dipotong dari
 * `items` saja, supaya `totalStok`, `baru`, `bekas`, dan `stokHabis`
 * neurotransmisi ulang. Kalau tidak, baris induk akan tetap menampilkan angka
 * katalog penuh padahal tabelnya sudah difilter.
 */
export function filterInventoryGroups(groups: InventoryGroup[], filter: InventoryFilter): InventoryGroup[] {
  const rawQuery = (filter.q ?? "").trim().toLowerCase();
  const tipe = filter.tipe ?? "semua";
  const stok = filter.stok ?? "semua";

  // Tanpa filter apa pun, kembalikan input apa adanya: jangan membangun ulang
  // group yang tidak berubah, itu buang-buang dan bisa mengubah referensi.
  if (rawQuery === "" && tipe === "semua" && stok === "semua") return groups;

  const result: InventoryGroup[] = [];
  for (const group of groups) {
    // Group yang namanya sendiri cocok tetap utuh, walau tidak ada variannya
    // yang cocok - orang mencari "iPhone 13" dan ingin semua variannya.
    const groupMatches = rawQuery !== "" && group.name.toLowerCase().includes(rawQuery);

    const items = group.items.filter((product) => {
      if (tipe !== "semua" && product.variant_type !== tipe) return false;
      if (!matchesStock(product.stock_qty ?? 0, stok)) return false;
      // Pencarian kosong harus lolos untuk semua varian. Kalau dicek sebagai
      // "tidak cocok dengan ''", setiap varian tersaring dan filter tipe/stok
      // saja mengembalikan nol hasil.
      if (rawQuery === "" || groupMatches) return true;
      return matchesQuery(product, rawQuery);
    });

    if (items.length > 0) result.push(buildInventoryGroup(group.key, items));
  }
  return result;
}
