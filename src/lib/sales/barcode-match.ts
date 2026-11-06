/**
 * Cocokkan hasil scan ke produk: barcode dulu, lalu SKU.
 *
 * Barcode dan SKU disimpan dalam bentuk apa adanya (bisa beda huruf besar/kecil
 * antar input), jadi perbandingannya case-insensitive. Barcode diutamakan
 * karena itulah yang biasanya ditempel di barang.
 */
export function matchProductByCode<
  T extends { sku: string; barcode?: string | null },
>(products: readonly T[], raw: string): T | null {
  const code = raw.trim().toLowerCase();
  if (!code) return null;
  return (
    products.find((p) => p.barcode?.trim().toLowerCase() === code) ??
    products.find((p) => p.sku.trim().toLowerCase() === code) ??
    null
  );
}
