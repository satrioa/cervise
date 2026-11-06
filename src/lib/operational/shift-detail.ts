/**
 * Helper tampilan untuk dialog "Detail Ringkasan Shift".
 *
 * Hanya membaca `ShiftReport` yang sudah dirakit server — tidak ada query dan
 * tidak ada `Date.now()`, pola yang sama dengan `laporan-shift.ts`.
 */

import type { ShiftReport } from "./laporan-shift";

const WIB = "Asia/Jakarta";

/** Jam WIB `HH:mm` dari ISO. ISO yang tidak valid dikembalikan apa adanya. */
export function shiftClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** `2026-10-24` -> "24 Okt 2026". Titik acuan UTC supaya tidak bergeser hari. */
export function shiftDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Menit -> "5j 12m". `null` kalau durasi tidak tersedia (snapshot lama).
 *
 * Nilai negatif dijadikan 0: shift yang jam tutupnya lebih awal dari jam buka
 * hanya mungkin karena data rusak, dan "-1j" di layar tidak membantu siapa pun.
 */
export function shiftDuration(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}j ${total % 60}m`;
}

export type ShiftBreakdownRow = {
  key: string;
  label: string;
  amount: number;
  /** `in`/`out` hanya untuk kas manual, supaya tandanya bisa diwarnai. */
  tone: "in" | "out" | null;
};

/**
 * Baris penyusun "harus ada di laci": saldo awal + omzet + kas manual.
 *
 * Kas masuk/keluar yang nol tidak ditampilkan — baris "Kas keluar Rp 0" hanya
 * menambah tinggi tanpa memberi tahu apa pun.
 */
export function shiftBreakdown(report: ShiftReport): ShiftBreakdownRow[] {
  const rows: ShiftBreakdownRow[] = [
    { key: "opening", label: "Saldo awal", amount: report.openingBalance, tone: null },
    { key: "services", label: "Omzet servis", amount: report.totals.services, tone: null },
    { key: "sales", label: "Omzet penjualan", amount: report.totals.sales, tone: null },
  ];
  if (report.totals.manualIn > 0) {
    rows.push({ key: "manualIn", label: "Kas masuk", amount: report.totals.manualIn, tone: "in" });
  }
  if (report.totals.manualOut > 0) {
    rows.push({ key: "manualOut", label: "Kas keluar", amount: report.totals.manualOut, tone: "out" });
  }
  return rows;
}
