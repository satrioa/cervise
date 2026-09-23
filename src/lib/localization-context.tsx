"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export type FirstDay = "sun" | "mon" | "sat";
export type TimeFormat = "h12" | "h24";
export type DateFormatId = "mdy-slash" | "dmy-slash" | "iso" | "med";
export type NumberFormatId = "us" | "eu" | "fr";

export const LANGUAGES: { value: string; flag: string; label: string; bcp47: string }[] = [
  { value: "id-ID", flag: "🇮🇩", label: "Bahasa Indonesia", bcp47: "id-ID" },
  { value: "en-US", flag: "🇺🇸", label: "English (US)", bcp47: "en-US" },
  { value: "en-GB", flag: "🇬🇧", label: "English (UK)", bcp47: "en-GB" },
  { value: "fr-FR", flag: "🇫🇷", label: "Français", bcp47: "fr-FR" },
  { value: "de-DE", flag: "🇩🇪", label: "Deutsch", bcp47: "de-DE" },
  { value: "ja-JP", flag: "🇯🇵", label: "日本語", bcp47: "ja-JP" },
  { value: "zh-CN", flag: "🇨🇳", label: "中文 简体", bcp47: "zh-CN" },
  { value: "es-ES", flag: "🇪🇸", label: "Español", bcp47: "es-ES" },
  { value: "pt-BR", flag: "🇧🇷", label: "Português Brasil", bcp47: "pt-BR" },
];

export type TimezoneItem = {
  value: string;
  label: string;
  region: "Americas" | "Europe" | "Asia" | "Pacific";
};

export const TIMEZONES: TimezoneItem[] = [
  { value: "Asia/Jakarta", label: "Jakarta (WIB)", region: "Asia" },
  { value: "Asia/Makassar", label: "Makassar (WITA)", region: "Asia" },
  { value: "Asia/Jayapura", label: "Jayapura (WIT)", region: "Asia" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", region: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", region: "Asia" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", region: "Asia" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)", region: "Asia" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)", region: "Americas" },
  { value: "America/Denver", label: "Denver (MT)", region: "Americas" },
  { value: "America/Chicago", label: "Chicago (CT)", region: "Americas" },
  { value: "America/New_York", label: "New York (ET)", region: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)", region: "Americas" },
  { value: "Europe/London", label: "London (GMT)", region: "Europe" },
  { value: "Europe/Paris", label: "Paris (CET)", region: "Europe" },
  { value: "Europe/Berlin", label: "Berlin (CET)", region: "Europe" },
  { value: "Europe/Madrid", label: "Madrid (CET)", region: "Europe" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)", region: "Pacific" },
  { value: "Pacific/Auckland", label: "Auckland (NZDT)", region: "Pacific" },
  { value: "Pacific/Honolulu", label: "Honolulu (HST)", region: "Pacific" },
];

export const CURRENCIES: { value: string; label: string; symbol: string }[] = [
  { value: "IDR", label: "IDR — Rupiah", symbol: "Rp" },
  { value: "USD", label: "USD — US Dollar", symbol: "$" },
  { value: "EUR", label: "EUR — Euro", symbol: "€" },
  { value: "GBP", label: "GBP — British Pound", symbol: "£" },
  { value: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { value: "CAD", label: "CAD — Canadian Dollar", symbol: "$" },
  { value: "AUD", label: "AUD — Australian Dollar", symbol: "$" },
];

export const DATE_FORMATS: { id: DateFormatId; label: string; example: string; hint: string }[] = [
  { id: "mdy-slash", label: "MM/DD/YYYY", example: "12/31/2025", hint: "US" },
  { id: "dmy-slash", label: "DD/MM/YYYY", example: "31/12/2025", hint: "EU" },
  { id: "iso", label: "YYYY-MM-DD", example: "2025-12-31", hint: "ISO 8601" },
  { id: "med", label: "MMM D, YYYY", example: "Dec 31, 2025", hint: "Long" },
];

export const NUMBER_FORMATS: { id: NumberFormatId; example: string; locale: string; hint: string }[] = [
  { id: "us", example: "1,234.56", locale: "en-US", hint: "US / UK" },
  { id: "eu", example: "1.234,56", locale: "de-DE", hint: "DE / ES" },
  { id: "fr", example: "1 234,56", locale: "fr-FR", hint: "FR / SE" },
];

export type LocaleState = {
  language: string;
  timezone: string;
  firstDay: FirstDay;
  dateFormat: DateFormatId;
  timeFormat: TimeFormat;
  currency: string;
  numberFormat: NumberFormatId;
};

export const DEFAULT_LOCALE: LocaleState = {
  language: "id-ID",
  timezone: "Asia/Jakarta",
  firstDay: "mon",
  dateFormat: "dmy-slash",
  timeFormat: "h24",
  currency: "IDR",
  numberFormat: "us",
};

export function formatDate(date: Date, id: DateFormatId, timezone: string): string {
  switch (id) {
    case "iso": {
      return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(date);
    }
    case "med":
      return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: timezone }).format(date);
    case "dmy-slash":
      return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(date);
    case "mdy-slash":
    default:
      return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(date);
  }
}

export function formatTime(date: Date, format: TimeFormat, language: string, timezone: string): string {
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", hour12: format === "h12", timeZone: timezone }).format(date);
}

export function buildWeek(today: Date, firstDay: FirstDay, language: string) {
  const startMap: Record<FirstDay, number> = { sun: 0, mon: 1, sat: 6 };
  const desiredStart = startMap[firstDay];
  const todayDow = today.getDay();
  const offset = (todayDow - desiredStart + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - offset);
  const days: { iso: string; weekday: string; day: number; isToday: boolean }[] = [];
  const wdFmt = new Intl.DateTimeFormat(language, { weekday: "short" });
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      weekday: wdFmt.format(d),
      day: d.getDate(),
      isToday: d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate(),
    });
  }
  return days;
}

export function firstDayLabel(d: FirstDay): string {
  return d === "sun" ? "Sunday" : d === "mon" ? "Monday" : "Saturday";
}

const STORAGE_KEY = "cervise-locale";

function parseStored(v: string | null): LocaleState | null {
  if (!v) return null;
  try {
    const p = JSON.parse(v);
    if (p && typeof p.language === "string" && typeof p.timezone === "string") return p as LocaleState;
  } catch {}
  return null;
}

type LocaleContextValue = {
  locale: LocaleState;
  setLocale: (next: LocaleState) => void;
  updateLocale: (patch: Partial<LocaleState>) => void;
  formatCurrency: (amount: number) => string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatDateF: (date: Date) => string;
  formatTimeF: (date: Date) => string;
  formatRelative: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
};

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<LocaleState>(DEFAULT_LOCALE);

  // hydrate from localStorage
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const parsed = parseStored(stored);
    if (parsed) setLocaleState(parsed);
    if (parsed?.language && typeof document !== "undefined") {
      document.documentElement.lang = parsed.language;
      document.cookie = `NEXT_LOCALE=${parsed.language.split("-")[0]}; path=/; max-age=31536000`;
    } else if (typeof document !== "undefined") document.documentElement.lang = DEFAULT_LOCALE.language;
  }, []);

  // sync from Supabase + auth listener
  React.useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const fetchRemote = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
      const remote = (data?.settings as any)?.locale as LocaleState | undefined;
      if (!mounted) return;
      if (remote && remote.language) {
        setLocaleState(remote);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
        document.documentElement.lang = remote.language;
        document.cookie = `NEXT_LOCALE=${remote.language.split("-")[0]}; path=/; max-age=31536000`;
      } else {
        const local = parseStored(window.localStorage.getItem(STORAGE_KEY));
        if (local && local.language) {
          // push local to remote first time
          const { data: cur } = await supabase.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
          const merged = { ...((cur?.settings as any) ?? {}), locale: local };
          await supabase.from("profiles").update({ settings: merged } as any).eq("id", auth.user.id);
        }
      }
    };
    fetchRemote();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        supabase
          .from("profiles")
          .select("settings")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            const remote = (data?.settings as any)?.locale as LocaleState | undefined;
            if (remote?.language) {
              setLocaleState(remote);
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
              document.documentElement.lang = remote.language;
              document.cookie = `NEXT_LOCALE=${remote.language.split("-")[0]}; path=/; max-age=31536000`;
            }
          });
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // cross-tab
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const p = parseStored(e.newValue);
        if (p) {
          setLocaleState(p);
          document.documentElement.lang = p.language;
          document.cookie = `NEXT_LOCALE=${p.language.split("-")[0]}; path=/; max-age=31536000`;
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = React.useCallback((next: LocaleState) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      document.documentElement.lang = next.language;
      const short = next.language.split("-")[0];
      document.cookie = `NEXT_LOCALE=${short}; path=/; max-age=31536000`;
      window.dispatchEvent(new CustomEvent("cervise-locale-change", { detail: next }));
    }
    // async Supabase sync fire-and-forget
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("settings")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: cur }) => {
          const merged = { ...((cur?.settings as any) ?? {}), locale: next };
          supabase.from("profiles").update({ settings: merged } as any).eq("id", data.user.id).then(() => {});
        });
    });
  }, []);

  const updateLocale = React.useCallback(
    (patch: Partial<LocaleState>) => {
      setLocaleState((prev) => {
        const next = { ...prev, ...patch };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          document.documentElement.lang = next.language;
          const short = next.language.split("-")[0];
          document.cookie = `NEXT_LOCALE=${short}; path=/; max-age=31536000`;
          window.dispatchEvent(new CustomEvent("cervise-locale-change", { detail: next }));
        }
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
          if (!data.user) return;
          supabase
            .from("profiles")
            .select("settings")
            .eq("id", data.user.id)
            .maybeSingle()
            .then(({ data: cur }) => {
              const merged = { ...((cur?.settings as any) ?? {}), locale: next };
              supabase.from("profiles").update({ settings: merged } as any).eq("id", data.user.id).then(() => {});
            });
        });
        return next;
      });
    },
    [],
  );

  const localeForNumber = NUMBER_FORMATS.find((n) => n.id === locale.numberFormat)?.locale ?? locale.language;

  const formatCurrency = React.useCallback(
    (amount: number) => {
      try {
        return new Intl.NumberFormat(localeForNumber, { style: "currency", currency: locale.currency, currencyDisplay: "narrowSymbol" }).format(amount);
      } catch {
        return `Rp ${Number(amount).toLocaleString("id-ID")}`;
      }
    },
    [locale.currency, localeForNumber],
  );

  const formatNumber = React.useCallback(
    (value: number, opts?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(localeForNumber, opts).format(value);
    },
    [localeForNumber],
  );

  const formatDateF = React.useCallback(
    (date: Date) => formatDate(date, locale.dateFormat, locale.timezone),
    [locale.dateFormat, locale.timezone],
  );

  const formatTimeF = React.useCallback(
    (date: Date) => formatTime(date, locale.timeFormat, locale.language, locale.timezone),
    [locale.language, locale.timeFormat, locale.timezone],
  );

  const formatRelative = React.useCallback(
    (value: number, unit: Intl.RelativeTimeFormatUnit) => {
      try {
        return new Intl.RelativeTimeFormat(locale.language, { numeric: "auto" }).format(value, unit);
      } catch {
        return `${value} ${unit}`;
      }
    },
    [locale.language],
  );

  const value = React.useMemo(
    () => ({ locale, setLocale, updateLocale, formatCurrency, formatNumber, formatDateF, formatTimeF, formatRelative }),
    [locale, setLocale, updateLocale, formatCurrency, formatNumber, formatDateF, formatTimeF, formatRelative],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useLocaleOptional() {
  return React.useContext(LocaleContext);
}
