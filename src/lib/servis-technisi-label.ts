/**
 * Label untuk teknisi, dipakai form create dan form edit.
 *
 * Modul ini sengaja terpisah dari komponennya supaya bisa diuji tanpa menarik
 * `next/navigation` dan seluruh pohon komponen client.
 *
 * Kenapa perlu satu fungsi: sebelumnya trigger dan daftar item masing-masing
 * menulis logikanya sendiri, dan keduanya berbeda -- daftar jatuh ke
 * `id.slice(0, 6)`, sementara trigger tidak punya children sama sekali sehingga
 * base-ui menampilkan UUID mentah. Dua tempat, dua bentuk bug yang sama: nama
 * orang tidak pernah muncul.
 */

export type TeknisiOpsi = { id: string; full_name: string | null; phone: string | null };

/**
 * Urutan fallback: nama, lalu nomor, baru teks jujur.
 *
 * Nomor dipakai sebagai cadangan karena role TEKNISIAN mewajibkannya ada, jadi
 * hampir selalu tersedia dan lebih berguna daripada id. Cadangan terakhir
 * sengaja BUKAN potongan id: `id.slice(0, 6)` terlihat seperti data yang
 * benar tapi isinya milik mesin, dan itu lebih buruk daripada mengakui tidak
 * ada namanya. `undefined`/`null` menghasilkan teks placeholder, bukan string
 * kosong, supaya trigger tidak pernah tampak kosong tanpa penjelasan.
 */
export function teknisiLabel(t: TeknisiOpsi | undefined | null): string {
  if (!t) return "Pilih teknisi";
  const name = t.full_name?.trim();
  if (name) return name;
  const phone = t.phone?.trim();
  if (phone) return phone;
  return "Tanpa nama";
}
