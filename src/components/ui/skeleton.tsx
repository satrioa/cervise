"use client";

import type * as React from "react";
import { AsciiSkeleton, type AsciiSkeletonProps } from "@/components/ui/ascii";
import { cn } from "@/lib/utils";

type SkeletonProps = Omit<React.ComponentProps<"div">, "children"> &
  Pick<
    AsciiSkeletonProps,
    | "as"
    | "rows"
    | "lines"
    | "widths"
    | "seed"
    | "animate"
    | "circle"
    | "width"
    | "height"
  >;

/**
 * Placeholder standar aplikasi: pola ASCII **Dither** dari `ascii-reveal`.
 *
 * Dulu kotak abu-abu `animate-pulse`; sekarang glyph `░▒▓█` dengan shimmer.
 * Pemanggil lama tidak perlu berubah — kelas ukuran (`h-4 w-24`, `size-5`,
 * `min-h-8 flex-1`) tetap menentukan kotak yang diisi pola. Glyph dibuat
 * kecil (7px) supaya rapat bahkan untuk bar setinggi `h-3`, dan `rows` yang
 * banyak membuat kotak tinggi tetap terisi penuh (sisanya dipotong).
 *
 * `rows` bisa ditimpa per pemakaian untuk blok tinggi (mis. `rows={18}` untuk
 * panel setinggi `h-40`), karena generator menggambar 96–120 glyph per baris
 * dan baris yang berlebih dipotong `overflow-hidden`.
 *
 * PENTING: `Skeleton` hanya mengisi KOTAK. Ia tidak tahu bentuk apa yang akan
 * menggantikannya. Kalau area itu sebenarnya tabel, daftar, grafik, atau
 * kartu, bentukkan dari markup yang sama dengan hasil render — pakai
 * primitive di `@/components/ui/skeleton-shapes` (`TableRowsSkeleton`,
 * `ListRowsSkeleton`, `ChartSkeleton`, `StatValueSkeleton`, `TimelineSkeleton`)
 * atau `loading.tsx` route. Baris placeholder tunggal (jumlah, tombol, teks
 * pendek) tetap cocok memakai `Skeleton` biasa.
 *
 * Di dalam `<p>`/`<span>` pakai `as="span"` supaya tidak memecah nesting HTML
 * (div di dalam p membuat browser menutup paragraf lebih awal).
 */
function Skeleton({ className, rows = 12, as = "div", ...props }: SkeletonProps) {
  return (
    <AsciiSkeleton
      as={as}
      data-slot="skeleton"
      rows={rows}
      className={cn("block w-full overflow-hidden rounded-md text-[7px]", className)}
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
