"use client";

import Link from "next/link";
import {
  ClipboardList,
  Globe2,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SheetTitle } from "@/components/ui/sheet";
import { navFor, normalizeAppRole, type AppRole } from "@/lib/nav/manifest";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type QuickCard = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  tileClass: string;
};

const TECHNICIAN_QUICK: QuickCard[] = [
  { href: "/app/servis", labelKey: "service", icon: Wrench, tileClass: "bg-[#2F80ED]" },
  { href: "/app/kategori-sparepart", labelKey: "sparepart", icon: Package, tileClass: "bg-[#EB5757]" },
  { href: "/app/laporan/servis", labelKey: "reportService", icon: ClipboardList, tileClass: "bg-[#F2C94C]" },
];

const FRONTLINER_QUICK: QuickCard[] = [
  { href: "/app/servis", labelKey: "service", icon: Wrench, tileClass: "bg-[#2F80ED]" },
  { href: "/app/penjualan", labelKey: "sales", icon: ShoppingCart, tileClass: "bg-[#27AE60]" },
  { href: "/app/laporan/servis", labelKey: "reportService", icon: ClipboardList, tileClass: "bg-[#F2C94C]" },
];

/** Ikon yang lebih spesifik untuk dua entri akun yang sama-sama memakai gear. */
const ROW_ICON: Record<string, LucideIcon> = {
  profile: UserRound,
  localization: Globe2,
};

/**
 * Isi drawer "Operasional" shell compact.
 *
 * Semua akses halaman dikumpulkan dalam satu daftar per role. Tiga menu
 * operasional utama tampil sebagai kartu putih dengan icon tile berwarna,
 * sisanya menjadi baris flat dengan plus - mengikuti frame Figma. Menu yang
 * tidak ada di aplikasi (System Preferences/Sound System) tidak dibuat; yang
 * dirender hanya entri nyata dari `NAV_ENTRIES`.
 */
export function CompactMenuSheet({
  role,
  onNavigate,
  onClose,
}: {
  role: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations("nav");
  const normalized: AppRole | null = normalizeAppRole(role);
  const quick = normalized === "FRONTLINER" ? FRONTLINER_QUICK : TECHNICIAN_QUICK;
  const quickHrefs = new Set(quick.map((item) => item.href));

  const entries = navFor(role, "compact", { includeHidden: true })
    .flatMap((block) => block.entries)
    .filter((entry) => entry.href !== "/app" && !quickHrefs.has(entry.href));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F1F1F1] dark:bg-neutral-950">
      <header className="flex shrink-0 items-center gap-2.5 px-5 pt-5">
        <LayoutGrid className="size-5 shrink-0 text-neutral-900 dark:text-neutral-100" />
        <SheetTitle className="text-lg font-semibold tracking-tight">Operasional</SheetTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup menu"
          title="Tutup menu"
          className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-black/[0.06] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Minus className="size-5" />
        </button>
      </header>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-2 gap-3 px-5">
          {quick.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex min-h-[6.75rem] flex-col items-start justify-between rounded-[20px] border border-black/5 bg-white p-3.5 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.35)] transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-neutral-800"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-[14px] text-white shadow-sm",
                    item.tileClass,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="mt-3 text-sm font-medium leading-tight text-neutral-900 dark:text-neutral-100">
                  {t(`items.${item.labelKey}`)}
                </span>
              </Link>
            );
          })}
        </div>

        <ul className="mt-5 divide-y divide-black/10 border-t border-black/10 px-5 dark:divide-white/10 dark:border-white/10">
          {entries.map((entry) => {
            const Icon = ROW_ICON[entry.key] ?? entry.icon;
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  className="-mx-2 flex items-center gap-3 px-2 py-3.5 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.04]"
                >
                  <Icon className="size-[18px] shrink-0 text-neutral-500 dark:text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
                    {t(`items.${entry.key}`)}
                  </span>
                  <Plus className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center">
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
