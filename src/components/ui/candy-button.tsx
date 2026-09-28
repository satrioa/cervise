import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tombol candy: gradien bulat, glow, dan animasi ditekan.
 *
 * Asalnya dari registry VengeanceUI dengan warna biru hex hardcoded
 * (#54A1FD / #005FD6 / #209BFF) dan `text-white`. Dua masalahnya:
 *
 * 1. Warna hex tidak tahu soal dark mode maupun tema aplikasi, dan proyek ini
 *    sudah punya sistem nada di components/dashboard/candy-shortcut.tsx.
 *    Polanya di sana: warna teks ditulis eksplisit per nada, bukan mengandalkan
 *    currentColor atau token accent-content, supaya label tetap terbaca di
 *    light dan dark.
 * 2. Versi asli tidak punya focus-visible. Tombol ini dipakai untuk aksi
 *    utama dashboard, jadi harus bisa dijangkau keyboard.
 *
 * Gradien dan glow-nya dipertahankan; hanya warnanya yang mengikuti nada.
 */

export const CANDY_BUTTON_TONES = [
  "primary",
  "accent-cyan",
  "accent-emerald",
  "accent-amber",
  "accent-violet",
] as const;

export type CandyButtonTone = (typeof CANDY_BUTTON_TONES)[number];

/**
 * Warna solid (bukan alpha rendah seperti di candy-shortcut). Tombol aksi
 * utama harus tetap terbaca sebagai tombol utama, jadi latar pekat dipakai
 * juga di dark mode. Teksnya gelap di light mode dan terang di dark mode
 * supaya kontrasnya tetap tinggi di dua tema.
 */
const TONE_STYLES: Record<CandyButtonTone, string> = {
  primary:
    "bg-[radial-gradient(95%_60%_at_50%_75%,var(--color-primary)_0%,color-mix(in_oklch,var(--color-primary)_72%,black)_100%)] text-primary-foreground",
  "accent-cyan":
    "bg-[radial-gradient(95%_60%_at_50%_75%,#22D3EE_0%,#0891B2_100%)] text-white dark:text-slate-950",
  "accent-emerald":
    "bg-[radial-gradient(95%_60%_at_50%_75%,#34D399_0%,#059669_100%)] text-white dark:text-slate-950",
  "accent-amber":
    "bg-[radial-gradient(95%_60%_at_50%_75%,#FBBF24_0%,#D97706_100%)] text-slate-950",
  "accent-violet":
    "bg-[radial-gradient(95%_60%_at_50%_75%,#A78BFA_0%,#7C3AED_100%)] text-white dark:text-slate-950",
};

/** Cincin glow sesuai nada, mengikuti warna gradien atas. */
const TONE_GLOW: Record<CandyButtonTone, string> = {
  primary: "shadow-[0_4px_48px_-12px_var(--color-primary),inset_0_1px_8px_-4px_rgba(255,255,255,0.7)]",
  "accent-cyan": "shadow-[0_4px_48px_-12px_#22D3EE,inset_0_1px_8px_-4px_rgba(255,255,255,0.6)]",
  "accent-emerald":
    "shadow-[0_4px_48px_-12px_#34D399,inset_0_1px_8px_-4px_rgba(255,255,255,0.6)]",
  "accent-amber": "shadow-[0_4px_48px_-12px_#FBBF24,inset_0_1px_8px_-4px_rgba(255,255,255,0.6)]",
  "accent-violet":
    "shadow-[0_4px_48px_-12px_#A78BFA,inset_0_1px_8px_-4px_rgba(255,255,255,0.6)]",
};

export type CandyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: CandyButtonTone;
  /** Menghapus padding horizontal default, untuk tombol yang hanya berisi ikon. */
  compact?: boolean;
  /**
   * Kalau diisi, tombol dirender sebagai Link navigasi klien.
   *
   * Versi registry hanya bisa diklik, jadi tanpa ini tombol candy tidak bisa
   * dipakai untuk berpindah halaman. CandyShortcut sebelumnya memakai
   * `window.location.href`, yang memuat ulang seluruh dokumen; Link hanya
   * menukar halaman di sisi klien.
   */
  href?: string;
};

export function CandyButton({
  className,
  children = "Candy Button",
  tone = "primary",
  compact = false,
  href,
  ...props
}: CandyButtonProps) {
  const classes = cn(
    "relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold leading-[22px] tracking-[0.02em] transition-all duration-200 ease-out",
    "active:scale-95 active:rotate-1",
    "hover:brightness-110",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    "after:absolute after:right-[10%] after:top-[1px] after:h-px after:w-[60%]",
    "after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent",
    compact ? "size-10 p-0" : "px-6 py-2.5 text-sm",
    TONE_STYLES[tone],
    TONE_GLOW[tone],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export default CandyButton;
