/**
 * Perintah ESC/POS tingkat rendah. Tanpa DOM dan tanpa dependensi, jadi bisa
 * diuji dengan byte biasa.
 *
 * 58mm = 32 kolom Font A. Perataan memakai spasi, bukan `ESC a`, supaya hasil
 * tetap rapi di printer murah yang mengabaikan perintah align.
 */

/** Lebar kertas dalam karakter. Ganti ke 48 untuk printer 80mm. */
export const PAPER_COLS = 32;

/** Bitmap 1-bit per baris, lebar dibulatkan ke kelipatan 8. */
export type EscposRaster = { width: number; height: number; data: number[] };

const ESC = 0x1b;
const GS = 0x1d;

/**
 * ESC/POS default hanya ASCII; karakter lain tampil rusak. Spasi non-breaking
 * dari `Intl` (Rp\u00a0…) dan tanda baca tipografis diterjemahkan dulu supaya
 * nominal tidak tercetak "Rp?8.200.000".
 */
const ASCII_MAP: Record<string, string> = {
  "\u00a0": " ",
  "\u202f": " ",
  "·": "-",
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
};

export function normalizeAscii(text: string): string {
  return String(text ?? "")
    .replace(/[\u00a0\u202f·–—‘’“”]/g, (char) => ASCII_MAP[char])
    .replace(/[^\x20-\x7e]+/g, "?");
}

export function init(): number[] {
  return [ESC, 0x40];
}

export function text(value: string): number[] {
  return Array.from(normalizeAscii(value), (char) => char.charCodeAt(0)).concat(0x0a);
}

export function align(where: "left" | "center" | "right"): number[] {
  return [ESC, 0x61, where === "center" ? 1 : where === "right" ? 2 : 0];
}

export function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

/** `double: true` = lebar dan tinggi dua kali (GS ! 0x11). */
export function size(double: boolean): number[] {
  return [GS, 0x21, double ? 0x11 : 0x00];
}

export function feed(lines = 1): number[] {
  return [ESC, 0x64, Math.max(0, Math.min(255, lines))];
}

/** Potong kertas (GS V 66 0). Hanya kirim kalau printer memang punya cutter. */
export function cut(): number[] {
  return [GS, 0x56, 0x42, 0x00];
}

/**
 * QR native model 2. Ukuran modul 1-16, EC level M. Data wajib ASCII dan
 * maksimal ±120 karakter; URL tracking aman.
 */
export function qr(data: string, moduleSize = 4): number[] {
  const payload = Array.from(normalizeAscii(data), (char) => char.charCodeAt(0));
  const length = payload.length + 3;
  return [
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // model 2
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize)), // ukuran modul
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31, // EC level M
    GS, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, 0x31, 0x50, 0x30, ...payload,
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30, // cetak
  ];
}

/**
 * Barcode Code 128 native (GS k 73). Data wajib ASCII. Kalau printer tidak
 * mendukung barcode, perintahnya diabaikan dan nomor servis tetap tercetak.
 */
export function barcode(data: string): number[] {
  const payload = Array.from(normalizeAscii(data), (char) => char.charCodeAt(0));
  if (payload.length === 0) return [];
  return [
    GS, 0x68, 0x50, // tinggi 80 dot
    GS, 0x77, 0x02, // lebar modul 2
    GS, 0x48, 0x02, // HRI di bawah barcode
    GS, 0x6b, 73, payload.length, ...payload,
  ];
}

/** Garis pemisah selebar kertas. */
export function line(char = "-", cols = PAPER_COLS): string {
  return char.repeat(cols);
}

export function columns(left: string, right: string, cols = PAPER_COLS): string {
  const value = normalizeAscii(right).slice(0, cols - 1);
  const label = normalizeAscii(left).slice(0, Math.max(0, cols - value.length - 1));
  return label + " ".repeat(Math.max(1, cols - label.length - value.length)) + value;
}

export function centerLine(value: string, cols = PAPER_COLS): string {
  const label = normalizeAscii(value).slice(0, cols);
  return " ".repeat(Math.max(0, Math.floor((cols - label.length) / 2))) + label;
}

/** Pecah teks panjang jadi beberapa baris tanpa memotong kata. */
export function wrap(value: string, cols = PAPER_COLS): string[] {
  const words = normalizeAscii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") current = word.slice(0, cols);
    else if (current.length + 1 + word.length <= cols) current += ` ${word}`;
    else {
      lines.push(current);
      current = word.slice(0, cols);
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function rasterCommand(logo: EscposRaster): number[] {
  const widthBytes = Math.ceil(logo.width / 8);
  return [
    GS, 0x76, 0x30, 0x00,
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    logo.height & 0xff, (logo.height >> 8) & 0xff,
    ...logo.data,
  ];
}

/**
 * Susun nota dari baris teks. Baris pertama dicetak dua kali tinggi selebar
 * kertas (lebar 16 kolom lalu digandakan), `boldLine` dicetak tebal.
 */
export function renderLines(
  lines: string[],
  options: {
    logo?: EscposRaster | null;
    boldLine?: (line: string) => boolean;
    /** Perintah tambahan setelah teks, mis. QR native, sebelum feed. */
    afterLines?: number[];
    cut?: boolean;
  } = {},
): Uint8Array {
  const bytes: number[] = [...init()];
  if (options.logo) bytes.push(...rasterCommand(options.logo));

  const isBold = options.boldLine ?? (() => false);
  lines.forEach((line, index) => {
    const boldOn = index === 0 || isBold(line);
    if (index === 0) bytes.push(...size(true));
    if (boldOn) bytes.push(...bold(true));
    bytes.push(...text(line));
    if (boldOn) bytes.push(...bold(false));
    if (index === 0) bytes.push(...size(false));
  });

  if (options.afterLines) bytes.push(...options.afterLines);
  bytes.push(...feed(4));
  if (options.cut) bytes.push(...cut());
  return Uint8Array.from(bytes);
}
