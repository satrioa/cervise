import { DEFAULT_LOCALE, NUMBER_FORMATS } from "./localization-context";

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