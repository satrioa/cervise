/**
 * Perkiraan uang yang keluar untuk retur, dihitung sebelum RPC dijalankan.
 *
 * Ini cermin dari logika di `return_sale_items_atomic`. Angka yang benar-benar
 * dipakai tetap yang dikembalikan RPC; fungsi ini hanya supaya kasir melihat
 * nominalnya di dialog sebelum menekan tombol, bukan setelah uangnya keluar.
 *
 * Kalau rumus di SQL berubah, ubah juga di sini - `retur.test.ts` mengunci
 * kasus diskon dan DP yang paling mudah salah.
 */
export type ReturSale = {
  subtotal: number;
  total: number;
  paid: number;
  /** Nilai barang yang sudah kembali dari retur sebelumnya. */
  returnedValue: number;
};

export type ReturItem = {
  qty: number;
  qtyReturned: number;
  unitPrice: number;
};

export function perkiraanRefund(sale: ReturSale, items: ReturItem[]): number {
  const gross = items.reduce((sum, it) => sum + it.qtyReturned * it.unitPrice, 0);
  const allReturned = items.every((it) => it.qty === it.qtyReturned);

  const value = allReturned
    ? sale.total
    : sale.subtotal > 0
      ? Math.floor((gross * sale.total) / sale.subtotal)
      : 0;

  const refund = Math.min(value, sale.paid) - Math.min(sale.returnedValue, sale.paid);
  return Math.max(0, refund);
}
