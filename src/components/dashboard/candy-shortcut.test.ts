import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANDY_TONES } from "./candy-shortcut";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const technician = read("src/components/dashboard/technician-dashboard.tsx");

/**
 * Gaya candy: ikon di kiri label, warna berbeda per tombol.
 *
 * Warna diambil dari posisi item lewat `CANDY_TONES`, bukan ditulis per item.
 * Kalau ditulis per item, menggeser urutan membuat warna terasa acak, dan
 * tidak ada yang mengunci bahwa setiap tombol harus punya warna berbeda.
 */
describe("CANDY_TONES", () => {
  it("nada cukup untuk empat kolom grid", () => {
    // Kedua dashboard memakai sm:grid-cols-4, jadi satu nada per kolom.
    // Kalau nada kurang dari kolom, ada tombol yang warnanya kembar.
    expect(CANDY_TONES.length).toBeGreaterThanOrEqual(4);
  });

  it("tidak ada nada yang kembar", () => {
    expect(new Set(CANDY_TONES).size).toBe(CANDY_TONES.length);
  });
});

describe("dashboard shortcut", () => {
  it("kedua dashboard memakai CandyShortcut, bukan ShortcutButton lokal", () => {
    // ShortcutButton lokal sudah dihapus. Kalau ada lagi, ada widget yang
    // tidak ikut mendapat gaya candy.
    expect(technician).not.toMatch(/function ShortcutButton/);
    expect(frontliner).not.toMatch(/function ShortcutButton/);
    expect(technician).toMatch(/CandyShortcut/);
    expect(frontliner).toMatch(/CandyShortcut/);
  });

  it("tiap shortcut punya ikon di kiri label", () => {
    // Tanpa `icon`, CandyShortcut tidak bisa merender kotak ikon dan label
    // akan duduk sendirian di tombol.
    const count = (source: string) => (source.match(/icon=\{/g) ?? []).length;
    expect(count(technician)).toBeGreaterThanOrEqual(4);
    expect(count(frontliner)).toBeGreaterThanOrEqual(4);
  });

  it("warna diambil dari posisi, bukan ditulis manual per tombol", () => {
    // Menulis tone per item membuat warna terlihat acak begitu urutannya
    // berubah, dan tidak ada yang mengunci tiap tombol punya warna sendiri.
    expect(technician).toMatch(/CANDY_TONES\[index % CANDY_TONES\.length\]/);
    expect(frontliner).toMatch(/CANDY_TONES\[\d\]/);
  });

  it('label "Input kas" diganti "Catat Kas"', () => {
    expect(frontliner).toMatch(/label="Catat Kas"/);
    expect(frontliner).not.toMatch(/Input kas/);
  });
});
