"use client";

import {
  AsciiReveal as AsciiRevealBase,
  AsciiSkeleton as AsciiSkeletonBase,
  type AsciiRevealProps,
  type AsciiSkeletonProps,
} from "ascii-reveal";
import { cn } from "@/lib/utils";

/**
 * Satu pintu untuk efek ASCII di Cervise.
 *
 * Preset dikunci di sini supaya seluruh app memakai bahasa visual yang sama:
 * - `AsciiSkeleton` → varian **Dither** (blok `░▒▓█`, shimmer).
 * - `AsciiReveal` → preset **Blueprint** (glyph garis di warna aksen).
 *
 * Preset masih bisa ditimpa per pemakaian lewat prop kalau suatu tempat butuh
 * efek lain, tapi default-nya jangan diubah diam-diam: halaman lain mengikuti.
 *
 * Warna dibaca dari CSS custom property yang dipasang di `globals.css`
 * (`--ascii-accent`, `--ascii-skeleton`, `--ascii-font`).
 */
export function AsciiReveal({
  className,
  preset = "blueprint",
  ...props
}: AsciiRevealProps) {
  return (
    <AsciiRevealBase
      preset={preset}
      className={cn("ascii-reveal", className)}
      {...props}
    />
  );
}

export function AsciiSkeleton({
  className,
  variant = "dither",
  ...props
}: AsciiSkeletonProps) {
  return (
    <AsciiSkeletonBase variant={variant} className={className} {...props} />
  );
}

export type { AsciiRevealProps, AsciiSkeletonProps };
