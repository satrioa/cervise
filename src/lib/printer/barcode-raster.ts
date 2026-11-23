import { code128B } from "@/lib/barcode/code128";
import type { EscposRaster } from "./escpos";

/**
 * Barcode Code 128 sebagai bitmap 1-bit untuk ESC/POS (GS v 0).
 *
 * Perintah barcode native (GS k) sering diabaikan printer thermal 58mm murah,
 * sehingga nota tercetak tanpa barcode. Bitmap selalu didukung karena memakai
 * jalur yang sama dengan logo.
 */
export function barcodeRaster(
  value: string,
  options: { moduleWidth?: number; height?: number; quietModules?: number; maxWidth?: number } = {},
): EscposRaster | null {
  const clean = String(value ?? "").trim();
  if (!clean) return null;

  const { widths } = code128B(clean);
  if (widths.length === 0) return null;

  // Setiap entri `widths` adalah jumlah modul berturut-turut (bar/space
  // bergantian), bukan satu modul. Bentangkan ke pattern per modul.
  const pattern: boolean[] = [];
  widths.forEach((moduleCount, index) => {
    for (let i = 0; i < moduleCount; i += 1) pattern.push(index % 2 === 0);
  });

  const quiet = Math.max(2, options.quietModules ?? 10);
  const modules = quiet + pattern.length + quiet;
  const wanted = modules * Math.max(1, options.moduleWidth ?? 2);
  const maxWidth = options.maxWidth ?? 384; // ~48mm cetak pada kertas 58mm
  const moduleWidth = wanted > maxWidth
    ? Math.max(1, Math.floor(maxWidth / modules))
    : Math.max(1, options.moduleWidth ?? 2);
  const height = Math.max(8, options.height ?? 64);
  const rawWidth = modules * moduleWidth;
  const width = Math.ceil(rawWidth / 8) * 8;
  const data: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let byte = 0; byte < width / 8; byte += 1) {
      let bits = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byte * 8 + bit;
        if (x >= rawWidth) continue;
        const moduleIndex = Math.floor(x / moduleWidth);
        if (moduleIndex < quiet || moduleIndex >= quiet + pattern.length) continue;
        if (pattern[moduleIndex - quiet]) bits |= 1 << (7 - bit);
      }
      data.push(bits);
    }
  }

  return { width, height, data };
}
