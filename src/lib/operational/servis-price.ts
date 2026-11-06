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

/**
 * Nominal yang harus dibayar customer.
 *
 * `record_service_payment` menulis `price` = total yang SUDAH dibayar, jadi
 * `price` tidak bisa dipakai sebagai tagihan begitu ada pembayaran. Patokannya
 * `price_estimasi`; `price` hanya dipakai kalau estimasi kosong (servis lama
 * atau harga yang disepakati di tempat).
 */
export function servisBill(
  price: number | null | undefined,
  estimasi: number | null | undefined,
): number {
  return Number(estimasi ?? 0) || Number(price ?? 0);
}

/** Sisa tagihan; 0 berarti lunas atau memang tidak ada tagihan. */
export function servisOutstanding(bill: number, paid: number): number {
  return Math.max(0, Number(bill ?? 0) - Math.max(0, Number(paid ?? 0)));
}
