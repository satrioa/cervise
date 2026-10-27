"use client";

import { BarChart3, LayoutGrid, Printer, Sun, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MenuSection } from "@/components/layout/menu-section";
import { MenuOperational } from "@/components/layout/menu-operational";
import { MenuAnalytic } from "@/components/layout/menu-analytic";
import { MenuPreferences } from "@/components/layout/menu-preferences";
import { MenuSound } from "@/components/layout/menu-sound";
import { PrinterSettings } from "@/components/pengaturan/printer-card";

/**
 * Isi drawer menu untuk TECHNICIAN dan FRONTLINER.
 *
 * Bentuknya empat section collapsible, bukan satu daftar flat:
 *   1. Operasional  - kartu semua halaman yang boleh dibuka role ini (default terbuka)
 *   2. Analytic Servis - ringkasan 30 hari + tautan ke halaman analitik
 *   3. System Preferences - tema dan bahasa
 *   4. Sound System - mute dan volume nada UI
 *
 * Tidak ada tombol tutup di header. Menutup drawer lewat Esc atau tap backdrop
 * (perilaku `Dialog` Base UI); ikon `+`/`-` di tiap section adalah toggle
 * section itu sendiri, bukan aksi tutup. `SheetTitle` tetap dipasang tapi
 * `sr-only` karena Dialog membutuhkannya untuk nama aksesibel.
 *
 * Section boleh terbuka bersamaan; yang default terbuka hanya Operasional.
 */
export function CompactMenuSheet({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav.menu");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F1F1F1] dark:bg-neutral-950">
      <SheetTitle className="sr-only">{t("title")}</SheetTitle>
      <SheetDescription className="sr-only">{t("description")}</SheetDescription>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-2">
        <MenuSection icon={LayoutGrid} label={t("operational")} defaultOpen>
          <MenuOperational role={role} onNavigate={onNavigate} />
        </MenuSection>

        <MenuSection icon={BarChart3} label={t("analytic")}>
          <MenuAnalytic onNavigate={onNavigate} />
        </MenuSection>

        <MenuSection icon={Sun} label={t("preferences")}>
          <MenuPreferences />
        </MenuSection>

        <MenuSection icon={Volume2} label={t("sound")}>
          <MenuSound />
        </MenuSection>

        {/* Printer disimpan per perangkat (localStorage), jadi pengaturan ini
            memang milik frontliner/teknisi yang mencetak, bukan master admin. */}
        <MenuSection icon={Printer} label={t("printer")}>
          <PrinterSettings compact />
        </MenuSection>
      </div>

      <footer className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center">
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-neutral-900 text-[13px] font-semibold text-white dark:bg-white dark:text-neutral-900">
          C
        </span>
        <p className="mt-2 text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
          Cervise! All rights reserved.
        </p>
        <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
          V0.1.0 / Made by Sat.
        </p>
      </footer>
    </div>
  );
}
