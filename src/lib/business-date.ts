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

/**
 * Asia/Jakarta tidak punya daylight saving, jadi offset-nya selalu +07:00.
 * Kalau `BUSINESS_TIME_ZONE` diubah ke zona yang punya DST, konstanta ini harus
 * ikut dihitung ulang - `business-date.test.ts` gagal kalau berubah.
 */
const BUSINESS_UTC_OFFSET = "+07:00";

/**
 * Instan UTC dari pukul 00:00 tanggal toko.
 *
 * Untuk filter `gte("created_at", ...)` pada kolom timestamptz. `businessDate()`
 * mengembalikan tanggal, dan menempelkan `T00:00:00.000Z` padanya berarti
 * tengah malam UTC - tujuh jam terlalu malam untuk toko WIB, sehingga servis
 * jam 1 pagi tidak masuk hitungan "hari ini".
 */
export function businessDayStartIso(date: Date = new Date()): string {
  return new Date(`${businessDate(date)}T00:00:00${BUSINESS_UTC_OFFSET}`).toISOString();
}