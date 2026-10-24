"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { operationalEntries } from "@/lib/nav/compact-menu";
import { playCue } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Isi section "Operasional": grid dua kolom berisi SEMUA halaman yang boleh
 * dibuka role ini.
 *
 * Daftarnya datang dari `operationalEntries(role)`, jadi frontliner otomatis
 * mendapat Penjualan, Customer, dan Transaksi, sementara teknisi tidak. Tiga
 * kartu pertama mengikuti frame Figma (warna tile + label "Data ..."); sisanya
 * memakai warna netral supaya tidak ada dua modul yang terlihat sama penting.
 */
const TILE_CLASS: Record<string, string> = {
  "/app/servis": "bg-[#2F80ED]",
  "/app/kategori-sparepart": "bg-[#EB5757]",
  "/app/laporan/servis": "bg-[#F2C94C]",
  "/app/penjualan": "bg-[#27AE60]",
  "/app/inventori": "bg-[#9B51E0]",
  "/app/customer": "bg-[#2D9CDB]",
  "/app/garansi": "bg-[#F2994A]",
  "/app/keuangan/transaksi": "bg-[#219653]",
  "/app/keuangan/arus-kas": "bg-[#56CCF2]",
  "/app/laporan/keuangan": "bg-[#BB6BD9]",
  "/app/laporan/penjualan": "bg-[#6FCF97]",
};

/** Label khusus frame Figma; selebihnya memakai label manifest. */
const TILE_LABEL_KEY: Record<string, string> = {
  "/app/servis": "dataService",
  "/app/kategori-sparepart": "dataSparepart",
};

const FALLBACK_TILE = "bg-neutral-400";

export function MenuOperational({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const entries = operationalEntries(role);

  if (entries.length === 0) {
    return (
      <p className="rounded-lg bg-white/60 px-3 py-4 text-center text-[12px] text-neutral-500 dark:bg-white/[0.04] dark:text-neutral-400">
        {t("menu.empty")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {entries.map((entry) => {
        const Icon = entry.icon;
        const labelKey = TILE_LABEL_KEY[entry.href];
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={() => {
              playCue("tap");
              onNavigate?.();
            }}
            className="flex min-h-[5.25rem] flex-col items-start justify-between rounded-[18px] border border-black/5 bg-white p-3 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.35)] transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-neutral-800"
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-[12px] text-white shadow-sm",
                TILE_CLASS[entry.href] ?? FALLBACK_TILE,
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="mt-2 min-w-0 line-clamp-2 text-[12.5px] font-medium leading-tight text-neutral-900 dark:text-neutral-100">
              {t(`items.${labelKey ?? entry.key}`)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
