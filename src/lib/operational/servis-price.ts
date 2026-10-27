/**
 * Nominal tagihan sebuah servis.
 *
 * `cervise_services.price` tidak pernah diisi lewat UI: create selalu
 * menyimpan `price: 0` dan form hanya menulis `price_estimasi`, jadi
 *kolom `price` praktis mati untuk servis yang dibuat lewat aplikasi.
 * Nominal yang sebenarnya ada di `price_estimasi`; `price` dipakai kalau
 * sudah diisi (mis. hasil pencatatan manual).
 */
export function servisPrice(
  price: number | null | undefined,
  estimasi: number | null | undefined,
): number {
  return Number(price ?? 0) || Number(estimasi ?? 0);
}
