import { normalizeGaransiUnit, toDays } from "./garansi-list";

export type GaransiState = "belum_aktif" | "aktif" | "warning" | "segera_habis" | "expired";

export type GaransiMeta = {
  state: GaransiState;
  pct: number;
  daysLeft: number | null;
  total: number;
};

export type GaransiMetaInput = {
  garansiUntil: string | null;
  garansiValue: number;
  garansiUnit: string;
};

/**
 * Tombol "ceil <= 7 hari" dipakai untuk `segera_habis` dan "ceil <= 14 hari"
 * untuk `warning`, keduanya dihitung dari tengah malam hari berjalan supaya
 * label "N hari" tidak meleset satu hari di tepi zona waktu.
 */
export function garansiMeta(row: GaransiMetaInput, now: Date = new Date()): GaransiMeta {
  if (!row.garansiUntil) {
    return { state: "belum_aktif", pct: 0, daysLeft: null, total: toDays(row.garansiValue, normalizeGaransiUnit(row.garansiUnit)) };
  }

  const total = toDays(row.garansiValue, normalizeGaransiUnit(row.garansiUnit)) || 90;
  const until = new Date(row.garansiUntil);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  until.setHours(23, 59, 59, 999);

  const daysLeft = Math.ceil((until.getTime() - startOfToday.getTime()) / 86400000);
  const pct = Math.max(0, Math.min(100, Math.round((daysLeft / total) * 100)));

  if (daysLeft < 0) return { state: "expired", pct: 0, daysLeft, total };
  if (daysLeft <= 7) return { state: "segera_habis", pct, daysLeft, total };
  if (daysLeft <= 14) return { state: "warning", pct, daysLeft, total };
  return { state: "aktif", pct, daysLeft, total };
}
