"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ChevronDown, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { LANGUAGES, useLocale } from "@/lib/localization-context";
import { playCue } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Isi section "System Preferences": tema aplikasi dan bahasa antarmuka.
 *
 * Dua-duanya preferensi yang SUDAH ada di repo, bukan mock baru:
 * - tema lewat `next-themes` (`ThemeProvider` di `app/layout.tsx`), kunci
 *   `cervise-theme`, efeknya class `dark` di `<html>`;
 * - bahasa lewat `LocaleProvider`, yang sudah menyimpan ke localStorage,
 *   cookie `NEXT_LOCALE`, dan `profiles.settings.locale` di Supabase.
 *
 * Yang perlu diketahui: mengganti bahasa di sini mengubah preferensi dan
 * cookie, tetapi teks yang sudah dirender tidak ikut berganti sampai halaman
 * dimuat ulang — pesan next-intl di-resolve di server.
 */
const THEMES: { value: "light" | "dark" | "system"; labelKey: string; icon: LucideIcon }[] = [
  { value: "light", labelKey: "light", icon: Sun },
  { value: "dark", labelKey: "dark", icon: Moon },
  { value: "system", labelKey: "system", icon: Monitor },
];

export function MenuPreferences() {
  const t = useTranslations("nav.menu");
  const { theme, setTheme } = useTheme();
  const { locale, updateLocale } = useLocale();

  // Tema baru diketahui di client. `useSyncExternalStore` mengembalikan false
  // di server dan true setelah mount, jadi pill aktif tidak berkedip ke
  // "system" pada render pertama (pola yang sama dengan `theme-toggle.tsx`).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const activeTheme = mounted ? theme : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex rounded-full bg-black/[0.06] p-0.5 dark:bg-white/10">
        {THEMES.map((option) => {
          const Icon = option.icon;
          const active = activeTheme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setTheme(option.value);
                playCue("tap");
              }}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
              )}
            >
              <Icon className="size-3.5" />
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <select
          aria-label={t("language")}
          value={locale.language}
          onChange={(event) => {
            updateLocale({ language: event.target.value });
            playCue("tap");
          }}
          className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 pr-8 text-[12px] font-medium text-neutral-900 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2F80ED] dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 [&>option]:bg-white dark:[&>option]:bg-neutral-800"
        >
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
      </div>
    </div>
  );
}
