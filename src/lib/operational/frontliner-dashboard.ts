/**
 * Angka untuk dashboard kasir (frontliner).
 *
 * Logikanya sengaja dipisah dari server action supaya bisa diuji tanpa
 * Supabase - pola yang sama dengan `buildTechnicianKpi` di
 * `technician-dashboard.ts`.
 */

export type FrontlinerStatusRow = { status: string };

/**
 * Status servis yang masih dikerjakan. `Dijemput` tidak ada di CHECK
 * constraint, jadi tidak dicantumkan.
 */
const IN_PROGRESS_STATUS = new Set([
  "Masuk",
  "Diagnosa",
  "Menunggu Konfirmasi",
  "Menunggu Sparepart",
  "Dikerjakan",
]);

export type FrontlinerKpi = {
  /**
   * Status `Masuk` hari ini.
   *
   * Ini sebelumnya `rows.length` - seluruh servis hari ini apa pun statusnya.
   * Sekarang dihitung per status supaya strip "Ringkasan Servis" (5 Masuk /
   * 2 Selesai / 8 Diambil) menampilkan tiga kategori yang berbeda; kalau
   * `masuk` tetap jumlah semua baris, angkanya selalu berupa total dan dua
   * angka di sebelahnya jadi tidak ada artinya.
   */
  masuk: number;
  /** Status `Selesai` hari ini. */
  selesai: number;
  /** Status `Sudah Diambil` hari ini. */
  diambil: number;
  /** Status servis yang masih dikerjakan. */
  proses: number;
};

/**
 * `selesai` dan `diambil` sengaja dihitung terpisah. Kalau keduanya memakai
 * himpunan status yang sama, kedua angkanya selalu sama dan strip "Ringkasan
 * Servis" jadi tidak informatif.
 */
export function buildFrontlinerKpi(rows: FrontlinerStatusRow[]): FrontlinerKpi {
  return {
    masuk: rows.filter((row) => row.status === "Masuk").length,
    selesai: rows.filter((row) => row.status === "Selesai").length,
    diambil: rows.filter((row) => row.status === "Sudah Diambil").length,
    proses: rows.filter((row) => IN_PROGRESS_STATUS.has(row.status)).length,
  };
}
