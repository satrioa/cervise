import { describe, expect, it } from "vitest";
import {
  PAPER_COLS,
  centerLine,
  columns,
  cut,
  normalizeAscii,
  qr,
  renderLines,
  wrap,
} from "./escpos";

describe("ESC/POS dasar", () => {
  it("menormalkan spasi non-breaking dan tanda baca tipografis", () => {
    expect(normalizeAscii("Rp\u00a08.200 · Jakarta — “A”")).toBe('Rp 8.200 - Jakarta - "A"');
    expect(normalizeAscii("Casing 🚀")).toBe("Casing ?");
  });

  it("meratakan kiri-kanan tepat selebar kertas", () => {
    const line = columns("TOTAL", "8.200.000");
    expect(line.length).toBe(PAPER_COLS);
    expect(line.endsWith("8.200.000")).toBe(true);
    expect(centerLine("AB", 8)).toBe("   AB");
  });

  it("membungkus teks panjang tanpa memotong kata", () => {
    const rows = wrap("Samsung Galaxy S23 Ultra dengan layar rusak", 16);
    expect(rows.every((row) => row.length <= 16)).toBe(true);
    expect(rows.join(" ")).toContain("Ultra");
  });

  it("menulis panjang data QR di header perintah", () => {
    const url = "https://app.cervise.id/toko/lacak/ABC123";
    const bytes = qr(url);
    // GS ( k pL pH 31 50 30 <data>
    const start = bytes.findIndex(
      (value, index) =>
        value === 0x1d && bytes[index + 1] === 0x28 && bytes[index + 2] === 0x6b && bytes[index + 6] === 0x50,
    );
    expect(start).toBeGreaterThan(0);
    expect(bytes[start + 3] | (bytes[start + 4] << 8)).toBe(url.length + 3);
    // Diakhiri perintah cetak QR.
    expect(bytes.slice(-8)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  });

  it("tidak memotong kertas kecuali diminta", () => {
    const lines = ["Toko", "Baris"];
    expect(Array.from(renderLines(lines).slice(-3))).toEqual([0x1b, 0x64, 0x04]);
    expect(Array.from(renderLines(lines, { cut: true }).slice(-4))).toEqual(cut());
  });

  it("mencetak baris pertama dua kali tinggi dan tebal", () => {
    const bytes = Array.from(renderLines(["Toko", "Baris"]));
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes.slice(2, 5)).toEqual([0x1d, 0x21, 0x11]);
    expect(bytes.slice(5, 8)).toEqual([0x1b, 0x45, 0x01]);
  });
});
