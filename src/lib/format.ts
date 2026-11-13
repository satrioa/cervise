import { DEFAULT_LOCALE, NUMBER_FORMATS } from "./localization-context";

const RUPIAH = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/**
 * Nominal rupiah tanpa simbol mata uang dari locale user: dipakai halaman
 * billing/owner yang nominalnya selalu IDR dan tidak boleh ikut berubah kalau
 * user mengganti preferensi tampilan. `formatCurrencyPlain` berbeda -
 * dia membaca localStorage, jadi angkanya bisa berganti sendiri.
 */
export function formatRupiah(value: number): string {
  return `Rp${RUPIAH.format(value)}`;
}

export function formatCurrencyPlain(amount: number): string {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("cervise-locale");
      if (raw) {
        const p = JSON.parse(raw) as any;
        const currency = p.currency ?? DEFAULT_LOCALE.currency;
        const numberFormat = p.numberFormat ?? DEFAULT_LOCALE.numberFormat;
        const locale = NUMBER_FORMATS.find((n) => n.id === numberFormat)?.locale ?? p.language ?? DEFAULT_LOCALE.language;
        return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Number(amount));
      }
    } catch {}
  }
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", currencyDisplay: "narrowSymbol" }).format(Number(amount));
  } catch {
    return `Rp ${Number(amount).toLocaleString("id-ID")}`;
  }
}

export function formatNumberPlain(value: number): string {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("cervise-locale");
      if (raw) {
        const p = JSON.parse(raw) as any;
        const numberFormat = p.numberFormat ?? DEFAULT_LOCALE.numberFormat;
        const locale = NUMBER_FORMATS.find((n) => n.id === numberFormat)?.locale ?? p.language ?? DEFAULT_LOCALE.language;
        return new Intl.NumberFormat(locale).format(Number(value));
      }
    } catch {}
  }
  return Number(value).toLocaleString("id-ID");
}

// --- Ovio shared formatters (used by @/components/ovio/*) ---
const OVIO_NUMBER = new Intl.NumberFormat("en-US");
const OVIO_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const OVIO_SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const OVIO_MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const toOvioTime = (date: string | number) => (typeof date === "string" ? Date.parse(date) : date);

export const formatNumber = (n: number, options?: Intl.NumberFormatOptions) =>
  options ? new Intl.NumberFormat("en-US", options).format(n) : OVIO_NUMBER.format(n);

export const isoDate = (date: string | number) => new Date(toOvioTime(date)).toISOString().slice(0, 10);

export function formatDate(date: string | number): string {
  const time = toOvioTime(date);
  return Number.isNaN(time) ? String(date) : OVIO_DATE.format(time);
}

export function formatShortDate(date: string | number): string {
  const time = toOvioTime(date);
  return Number.isNaN(time) ? String(date) : OVIO_SHORT_DATE.format(time);
}

export const formatMonth = (year: number, month: number) =>
  OVIO_MONTH.format(Date.UTC(year, month - 1, 1));

export const plural = (n: number, noun: string, many = `${noun}s`) => (n === 1 ? noun : many);

export const formatCount = (n: number, noun: string, many?: string) =>
  `${formatNumber(n)} ${plural(n, noun, many)}`;

export const COMPACT = { notation: "compact", maximumFractionDigits: 1 } as const;
export const PAD3 = { minimumIntegerDigits: 3, useGrouping: false } as const;

export const dots = (label: string, width = 10) =>
  label + ".".repeat(Math.max(1, width - label.length));