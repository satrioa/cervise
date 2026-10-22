const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

export type RentangBulan = { from: Date; to: Date };

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Tanggal kalender di zona WIB sebagai `YYYY-MM-DD`.
 *
 * `toISOString().slice(0, 10)` mengembalikan hari UTC, dan WIB 7 jam di depan
 * UTC. Transaksi jam 00:00-07:00 waktu lokal jatuh di hari sebelumnya: salah
 * hari di Laporan Penjualan, salah hari di omzet Dashboard, salah `kas_date` di
 * Arus Kas, dan keluar dari shift yang sebenarnya sedang buka.
 */
export function kalenderWIB(date: Date = new Date()): string {
  const lokal = new Date(date.getTime() + OFFSET_WIB_MS);
  return `${lokal.getUTCFullYear()}-${pad2(lokal.getUTCMonth() + 1)}-${pad2(lokal.getUTCDate())}`;
}

/**
 * Instant dari tengah malam hari kalender WIB yang memuat `date`.
 *
 * Dipakai untuk batas bawah query harian. `T00:00:00.000Z` untuk hari yang
 * sama berarti 07:00 WIB, jadi tujuh jam pertama hari lokal justru excluded.
 */
export function awalHariWIB(date: Date = new Date()): Date {
  const lokal = new Date(date.getTime() + OFFSET_WIB_MS);
  return new Date(
    Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), lokal.getUTCDate()) - OFFSET_WIB_MS,
  );
}

export function rentangBulanSekarang(now: Date): RentangBulan {
  const lokal = new Date(now.getTime() + OFFSET_WIB_MS);
  const from = new Date(Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), 1) - OFFSET_WIB_MS);
  const to = new Date(Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth() + 1, 1) - OFFSET_WIB_MS);
  return { from, to };
}

export function dalamRentangBulan(nilai: string | null | undefined, now: Date): boolean {
  if (!nilai) return false;
  const waktu = new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return false;
  const { from, to } = rentangBulanSekarang(now);
  return waktu >= from && waktu < to;
}

export function dalamHariYangSama(nilai: string | null | undefined, now: Date): boolean {
  if (!nilai) return false;
  const waktu = new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return false;
  const lokal = new Date(waktu.getTime() + OFFSET_WIB_MS);
  const referensi = new Date(now.getTime() + OFFSET_WIB_MS);
  return (
    lokal.getUTCFullYear() === referensi.getUTCFullYear() &&
    lokal.getUTCMonth() === referensi.getUTCMonth() &&
    lokal.getUTCDate() === referensi.getUTCDate()
  );
}
