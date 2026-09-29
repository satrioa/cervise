import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANDY_TONES } from "./candy-shortcut";
import { CANDY_BUTTON_TONES } from "@/components/ui/candy-button";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/**
 * Komentar dibuang sebelum diperiksa. Komentar candy-button memang menyebut
 * hex lama itu sebagai penjelasan apa yang diganti, jadi tanpa filter ini
 * test akan gagal karena dokumentasinya, bukan karena kodenya.
 */
const readCode = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");

const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const technician = read("src/components/dashboard/technician-dashboard.tsx");
const candyButton = readCode("src/components/ui/candy-button.tsx");
const candyShortcut = readCode("src/components/dashboard/candy-shortcut.tsx");

/**
 * Dua widget candy yang berbeda, dan tugasnya dipisah:
 *
 * - CandyShortcut untuk GRID PINTASAN di dashboard. Bentuknya
 *   [ikon + label] [chevron kanan], datar, warnanya beda per tombol.
 * - CandyButton untuk TOMBOL BIASA satu aksi. Gradien, satu warna, tanpa
 *   chevron. Registry VengeanceUI menyebutnya "Candy Button" dan usage-nya
 *   sesederhana <CandyButton>Candy Button</CandyButton>.
 *
 * Pernah keduanya tertukar: grid pintasan diforce memakai CandyButton, yang
 * membuat chevron hilang dan empat tombol kehilangan warna berbeda. Test di
 * bawah menjaga pemisahan itu.
 */
describe("CandyShortcut untuk grid pintasan", () => {
  it("bentuknya [ikon + label] [chevron kanan]", () => {
    expect(candyShortcut).toMatch(/ArrowRightIcon/);
    expect(candyShortcut).toMatch(/group-hover:translate-x-0\.5/);
  });

  it("kedua dashboard memakainya untuk grid pintasan", () => {
    expect(technician).toMatch(/CandyShortcut/);
    expect(frontliner).toMatch(/CandyShortcut/);
  });

  it("nada diambil dari posisi tombol, bukan ditulis manual", () => {
    expect(technician).toMatch(/CANDY_TONES\[index % CANDY_TONES\.length\]/);
    expect(frontliner).toMatch(/CANDY_TONES\[index % CANDY_TONES\.length\]/);
  });

  it("nada cukup untuk empat kolom grid dan tidak ada yang kembar", () => {
    expect(CANDY_TONES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CANDY_TONES).size).toBe(CANDY_TONES.length);
  });
});

describe("CandyButton untuk aksi tunggal", () => {
  it("dipakai sebagai tombol biasa, bukan grid pintasan", () => {
    // Grid pintasan harus CandyShortcut. Kalau CandyButton masuk ke sana,
    // chevron hilang dan warna per tombol ikut hilang.
    const gridBlock = (source: string) =>
      source.slice(source.indexOf("grid-cols-2 gap-2 sm:grid-cols-4"));
    expect(gridBlock(technician)).not.toMatch(/CandyButton/);
    expect(gridBlock(frontliner)).not.toMatch(/CandyButton/);
  });

  it("memakai usage sederhana seperti di registry", () => {
    // children langsung jadi isi tombol; tidak ada mode widget yang
    // mengharuskan props khusus.
    expect(candyButton).toMatch(/children = "Candy Button"/);
  });

  it("dipakai untuk aksi nyata di dashboard frontliner", () => {
    expect(frontliner).toMatch(/<CandyButton[\s\S]*?Tutup Toko[\s\S]*?<\/CandyButton>/);
  });

  it("nada cukup untuk empat kolom dan tidak ada yang kembar", () => {
    expect(CANDY_BUTTON_TONES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CANDY_BUTTON_TONES).size).toBe(CANDY_BUTTON_TONES.length);
  });
});

describe("warna CandyButton disesuaikan, bukan hex mentah dari registry", () => {
  it("tidak ada warna hex biru hardcoded milik registry", () => {
    // Kode aslinya memakai bg gradien biru dan shadow biru; sekarang warnanya
    // datang dari CANDY_BUTTON_TONES dan token primary.
    expect(candyButton).not.toMatch(/#54A1FD|#005FD6|#209BFF|#1187FF/);
    expect(candyButton).toMatch(/CANDY_BUTTON_TONES|var\(--color-primary\)/);
  });

  it("setiap nada punya latar DAN warna teks, supaya terbaca di light dan dark", () => {
    for (const tone of CANDY_BUTTON_TONES) {
      const entry = candyButton.split(`"${tone}"`)[1] ?? "";
      expect(entry).toMatch(/text-/);
    }
  });

  it("punya focus-visible supaya bisa dijangkau keyboard", () => {
    expect(candyButton).toMatch(/focus-visible:outline/);
  });
});

describe("catatan tugas dipakai bersama oleh kedua dashboard", () => {
  it("keduanya memakai TaskNoteCard yang sama, bukan dua salinan", () => {
    expect(technician).toMatch(/TaskNoteCard/);
    expect(frontliner).toMatch(/TaskNoteCard/);
    expect(technician).not.toMatch(/function TodoCard/);
    expect(frontliner).not.toMatch(/function TodoCard/);
  });
});

describe("Servis Masuk di dashboard frontliner", () => {
  it("tingginya dikunci 460px dengan scroll internal", () => {
    // Tanpa tinggi tetap, daftar panjang akan mendorong KPI di bawahnya ikut
    // turun sehingga halaman ikut memanjang.
    expect(frontliner).toMatch(/h-\[460px\]/);
    expect(frontliner).toMatch(/overflow-y-auto/);
  });

  it("tidak lagi dipotong diam-diam di 12 item", () => {
    expect(frontliner).not.toMatch(/queue\.slice\(0, 12\)/);
  });
});
