import { normalizeInventorySlug } from "@/lib/operational/inventori";

/**
 * Validasi baris impor inventori dari Excel.
 *
 * Dipakai dua kali dengan aturan yang sama: di dialog (pratinjau + daftar
 * kesalahan sebelum kirim) dan di server action (validasi ulang, karena isi
 * file tidak boleh dipercaya). Semua-atau-tidak-sama-sekali: satu baris salah
 * membatalkan seluruh impor supaya stok tidak masuk setengah.
 */

export type InventoriImportRow = {
  nama?: string;
  sku?: string;
  kategori?: string;
  tipe?: string;
  storage?: string;
  warna?: string;
  stok?: number | string | null;
  modal?: number | string | null;
  jual?: number | string | null;
  barcode?: string | null;
  imei?: string | null;
  catatan?: string | null;
};

export type InventoriImportProduct = {
  name: string;
  sku: string;
  category: string;
  variant_type: "BARU" | "BEKAS";
  storage: string;
  warna: string;
  stock_qty: number;
  cost: number;
  price: number;
  barcode: string | null;
  imei: string | null;
  kondisi_notes: string | null;
  parent_key: string;
};

export const IMPORT_ROW_CAP = 500;

/** Header template, sekaligus urutan kolom yang diharapkan saat membaca file. */
export const IMPORT_HEADERS = [
  "nama",
  "sku",
  "kategori",
  "tipe",
  "storage",
  "warna",
  "stok",
  "modal",
  "jual",
  "barcode",
  "imei",
  "catatan",
] as const;

const CATEGORIES = ["Gadget", "Aksesori", "Lainnya"];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function number(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function prepareInventoriImport(
  rows: InventoriImportRow[],
  existingSkus: Iterable<string>,
): { products: InventoriImportProduct[]; errors: string[] } {
  const errors: string[] = [];
  const products: InventoriImportProduct[] = [];
  const taken = new Set(Array.from(existingSkus, (sku) => sku.trim().toUpperCase()));

  if (rows.length > IMPORT_ROW_CAP) {
    errors.push(`Maksimal ${IMPORT_ROW_CAP} baris per impor (file berisi ${rows.length}).`);
    return { products, errors };
  }

  rows.forEach((row, index) => {
    // +2: baris 1 adalah header Excel, jadi baris data pertama = baris 2.
    const line = index + 2;
    const fail = (message: string) => errors.push(`Baris ${line}: ${message}`);

    const name = text(row.nama);
    const sku = text(row.sku).toUpperCase();
    if (!name) return fail("nama wajib diisi");
    if (!sku) return fail(`SKU wajib diisi untuk ${name}`);

    const category = text(row.kategori) || "Gadget";
    if (!CATEGORIES.includes(category)) return fail(`kategori "${category}" tidak dikenal (Gadget/Aksesori/Lainnya)`);

    const tipeRaw = text(row.tipe).toUpperCase();
    const variant_type = tipeRaw === "BEKAS" ? "BEKAS" : "BARU";
    if (tipeRaw && tipeRaw !== "BARU" && tipeRaw !== "BEKAS") return fail(`tipe "${row.tipe}" harus BARU atau BEKAS`);

    const storage = text(row.storage);
    const warna = text(row.warna);
    if (!storage) return fail("storage wajib diisi");
    if (!warna) return fail("warna wajib diisi");

    const cost = number(row.modal);
    const price = number(row.jual);
    if (!Number.isFinite(cost) || cost < 0) return fail("modal harus angka >= 0");
    if (!Number.isFinite(price) || price < 0) return fail("jual harus angka >= 0");

    let stock_qty = Math.trunc(number(row.stok));
    let imei: string | null = null;
    if (variant_type === "BEKAS") {
      imei = text(row.imei);
      if (!/^\d{15}$/.test(imei)) return fail("IMEI 15 digit wajib untuk tipe BEKAS");
      // Satu unit bekas = satu IMEI, apa pun isi kolom stok.
      stock_qty = 1;
    } else if (!Number.isFinite(stock_qty) || stock_qty < 0) {
      return fail("stok harus bilangan bulat >= 0");
    }

    if (taken.has(sku)) return fail(`SKU ${sku} ganda (sudah ada di cabang ini atau di baris lain)`);
    taken.add(sku);

    products.push({
      name,
      sku,
      category,
      variant_type,
      storage,
      warna,
      stock_qty,
      cost,
      price,
      barcode: text(row.barcode) || null,
      imei,
      kondisi_notes: text(row.catatan) || null,
      parent_key: normalizeInventorySlug(name),
    });
  });

  return { products, errors };
}
