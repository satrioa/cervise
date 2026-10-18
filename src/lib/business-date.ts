export const BUSINESS_TIME_ZONE = "Asia/Jakarta";

/**
 * Tanggal kalender toko, selalu di zona Asia/Jakarta.
 *
 * Server produksi berjalan di UTC, jadi dua cara yang biasa dipakai sama-sama
 * salah untuk toko WIB:
 *
 * - `new Date().toISOString().slice(0, 10)` mengembalikan tanggal UTC.
 * - `date.getDate()` mengembalikan waktu lokal **server**, yang di Vercel juga UTC.
 *
 * Keduanya membuat transaksi antara 00:00 dan 07:00 WIB tercatat di laporan
 * tanggal sebelumnya. `en-CA` diformat ISO-like (YYYY-MM-DD), jadi hasilnya
 * bisa langsung dipakai sebagai nilai kolom `date`.
 *
 * `toLocalDateString` di `@/lib/operational/garansi-list` ikut memakai fungsi
 * ini; jangan tulis ulang pemformatannya di tempat lain.
 */
const FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE });

export function businessDate(date: Date = new Date()): string {
  return FORMATTER.format(date);
}