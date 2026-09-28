import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * Tombol candy di kedua dashboard.
 *
 * Sebelumnya widget ini ada di components/dashboard/candy-shortcut.tsx dan
 * dipakai sebagai CandyShortcut. Sekarang diganti CandyButton dari registry
 * VengeanceUI, dengan warna yang diadaptasi ke sistem nada proyek. Guard ini
 * ditulis ulang mengikuti komponen barunya, tapi niatnya sama: nada diambil
 * dari posisi tombol, bukan ditulis manual per item.
 */
describe("CANDY_BUTTON_TONES", () => {
  it("nada cukup untuk empat kolom grid", () => {
    // Kedua dashboard memakai sm:grid-cols-4, jadi satu nada per kolom.
    // Kalau nada kurang dari kolom, ada tombol yang warnanya kembar.
    expect(CANDY_BUTTON_TONES.length).toBeGreaterThanOrEqual(4);
  });

  it("tidak ada nada yang kembar", () => {
    expect(new Set(CANDY_BUTTON_TONES).size).toBe(CANDY_BUTTON_TONES.length);
  });
});

describe("kedua dashboard memakai CandyButton", () => {
  it("tidak ada CandyShortcut yang tersisa", () => {
    // ShortcutButton lokal sudah dihapus duluan, CandyShortcut sekarang
    // digantikan CandyButton. Kalau muncul lagi, ada widget yang tidak ikut
    // mendapat gaya candy yang baru.
    expect(technician).not.toMatch(/CandyShortcut/);
    expect(frontliner).not.toMatch(/CandyShortcut/);
    expect(technician).toMatch(/CandyButton/);
    expect(frontliner).toMatch(/CandyButton/);
  });

  it("warna diambil dari posisi, bukan ditulis manual per tombol", () => {
    expect(technician).toMatch(/CANDY_BUTTON_TONES\[index % CANDY_BUTTON_TONES\.length\]/);
    expect(frontliner).toMatch(/CANDY_BUTTON_TONES\[index % CANDY_BUTTON_TONES\.length\]/);
  });

  it('label "Input kas" diganti "Catat Kas"', () => {
    expect(frontliner).toMatch(/label: "Catat Kas"/);
    expect(frontliner).not.toMatch(/Input kas/);
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
    // Warna teks ditulis eksplisit per nada, bukan mengandalkan currentColor
    // atau token accent-content - mengikuti candy-shortcut yang lama.
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
    // Duplikat To-Do per dashboard akan buat perbaikan berikutnya hanya berlaku
    // untuk satu role.
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
