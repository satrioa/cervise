/**
 * Logika pencocokan untuk command palette.
 *
 * Dipisah dari komponen supaya aturan "maks 3 saran" dan kata kunci perintah
 * (`tambah`, `cari`, `stok`, ...) bisa diuji tanpa merender dialog.
 */

const STOCK_INTENT = /(^|\s)stok(\s|$)/;
const ADD_PREFIX = "tambah ";

/** Kata yang tidak ikut dicari saat pengguna menulis perintah, bukan nama. */
const STOP_WORDS = new Set([
  "tambah",
  "cari",
  "buat",
  "baru",
  "data",
  "stok",
  "produk",
  "customer",
  "pelanggan",
  "karyawan",
  "servis",
  "garansi",
  "transaksi",
  "nota",
  "arus",
  "kas",
]);

/** Kata pertama setelah "tambah" yang menandakan aksi lain, bukan nama produk. */
const ACTION_WORDS = new Set([
  "servis",
  "karyawan",
  "customer",
  "pelanggan",
  "produk",
  "stok",
  "kas",
  "kasir",
  "transaksi",
  "garansi",
]);

export function normalizeCommandQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Buang kata perintah, sisakan nama yang dicari. */
export function commandSearchTerm(query: string): string {
  return normalizeCommandQuery(query)
    .split(" ")
    .filter((word) => word !== "" && !STOP_WORDS.has(word))
    .join(" ")
    .trim();
}

/**
 * Apakah query sedang menanyakan produk?
 * - "tambah stok ..." dan "tambah stok" selalu ya.
 * - "tambah iphone" ya (kata setelah "tambah" bukan aksi lain).
 * - "tambah servis" tidak.
 */
export function wantsProductSuggestions(query: string): boolean {
  const term = normalizeCommandQuery(query);
  if (!term) return false;
  if (STOCK_INTENT.test(term)) return true;
  if (!term.startsWith(ADD_PREFIX)) return false;
  const first = term.slice(ADD_PREFIX.length).split(" ")[0] ?? "";
  return first !== "" && !ACTION_WORDS.has(first);
}

export function rankItems<T>(
  items: readonly T[],
  term: string,
  haystack: (item: T) => string,
  limit = 3,
): T[] {
  const needle = term.trim().toLowerCase();
  const matched = needle
    ? items.filter((item) => haystack(item).toLowerCase().includes(needle))
    : items;
  return matched.slice(0, limit);
}

export function matchProducts<T extends { name: string; sku: string }>(
  products: readonly T[],
  query: string,
  limit = 3,
): T[] {
  return rankItems(products, commandSearchTerm(query), (product) => `${product.name} ${product.sku}`, limit);
}

export function matchCustomers<T extends { name: string; phone: string }>(
  customers: readonly T[],
  query: string,
  limit = 3,
): T[] {
  return rankItems(customers, commandSearchTerm(query), (customer) => `${customer.name} ${customer.phone}`, limit);
}

export function matchQuickActions<T extends { label: string; keywords: string }>(
  actions: readonly T[],
  query: string,
  limit = 3,
): T[] {
  return rankItems(actions, normalizeCommandQuery(query), (action) => `${action.label} ${action.keywords}`, limit);
}
