/** Panjang maksimum; protects query ilike dari input yang tidak masuk akal. */
const MAX_TERM_LENGTH = 60;

/**
 * Bersihkan input pencarian sebelum masuk `.or()` PostgREST.
 *
 * `.or()` menerima string filter mentah, jadi `,` `(` `)` di dalam term akan
 * menambah klausa baru atau menutup klausa yang ada. Hasilnya bukan error yang
 * berguna untuk kasir — kadang daftar produk yang salah, kadang `400` dari
 * PostgREST. Tanda `%` dan `*` ikut dibuang karena keduanya wildcard di `ilike`.
 *
 * RLS tetappegang: sanitasi ini memperbaiki filter, bukan yang menjaga
 * boundaries antar tenant.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()*\\%]/g, "").trim().slice(0, MAX_TERM_LENGTH);
}