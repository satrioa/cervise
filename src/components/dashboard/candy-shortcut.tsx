"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gaya candy untuk tombol pintasan dashboard.
 *
 * Tiap nada adalah pasangan: satu untuk latar, satu untuk warna teks. Warna
 * teks ditulis eksplisit, bukan mengandalkan `currentColor` atau token
 * `accent-content`, supaya label tetap terbaca di light dan dark.
 *
 * Tone gelap pakai `dark:bg-*-500/15` (alpha rendah) daripada warna solid
 * gelap. Warna solid gelap di atas latar gelap membuat tombol terlihat
 * seperti lubang, bukan seperti tombol.
 */
export const CANDY_TONES = [
  "accent-cyan",
  "accent-amber",
  "accent-emerald",
  "accent-violet",
] as const;

export type CandyTone = (typeof CANDY_TONES)[number];

/**
 * Warna latar dan teks per nada. `hover` memakai langkah yang lebih gelap di
 * light mode dan lebih terang di dark mode, supaya arah hover tetap "naik"
 * di kedua tema.
 */
const TONE_STYLES: Record<CandyTone, string> = {
  "accent-cyan": "bg-cyan-100 text-cyan-950 hover:bg-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200",
  "accent-amber":
    "bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200",
  "accent-emerald":
    "bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200",
  "accent-violet":
    "bg-violet-100 text-violet-950 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-200",
};

const TONE_ICON_STYLES: Record<CandyTone, string> = {
  "accent-cyan": "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-300",
  "accent-amber": "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",
  "accent-emerald":
    "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300",
  "accent-violet": "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300",
};

export type CandyShortcutProps = {
  label: string;
  icon: LucideIcon;
  tone?: CandyTone;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * Tombol pintasan bergaya candy: ikon di kiri, label di kanan, warna berbeda
 * per tombol.
 *
 * `href` dan `onClick` bergantian, bukan keduanya. Kalau keduanya ada,
 * `onClick` menang dan navigasi tak terjadi -- jadi pemanggil bisa salah
 * tanpa tanda. Plus `window.location.href` untuk tombol biasa: memuat ulang
 * seluruh dokumen, sedangkan `router.push` cukup menukar halaman di sisi
 * klien.
 */
export function CandyShortcut({
  label,
  icon: Icon,
  tone = "accent-cyan",
  href,
  onClick,
  className,
}: CandyShortcutProps) {
  const handle = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (href) window.location.href = href;
  };

  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        TONE_STYLES[tone],
        className,
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          TONE_ICON_STYLES[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <ArrowRightIcon
        className="size-3.5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-80"
        aria-hidden
      />
    </button>
  );
}
