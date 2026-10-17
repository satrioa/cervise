const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

export type RentangBulan = { from: Date; to: Date };

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
