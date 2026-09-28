import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPACT_GRID_TEMPLATE, COMPACT_ICON_CLASS, COMPACT_ICON_SIZE, COMPACT_RAIL_WIDTH } from "./compact-sidebar";

/**
 * `COMPACT_RAIL_WIDTH` masuk ke `gridTemplateColumns` sebagai nilai mentah,
 * bukan lewat kelas Tailwind. Kalau formatnya salah, grid itu tidak error —
 * kolom pertama diam-diam jatuh ke `auto` dan rail melebar mengikuti konten.
 * Jadi bentuk stringnya perlu dijaga.
 */
describe("COMPACT_RAIL_WIDTH", () => {
  it("adalah nilai CSS valid", () => {
    expect(COMPACT_RAIL_WIDTH).toMatch(/^[\w.(),%\s-]+$/);
  });

  it("piksel tetap, bukan clamp — diminta langsung", () => {
    expect(COMPACT_RAIL_WIDTH).toBe("70px");
  });

  it("cukup untuk ikon di atas label tiga baris", () => {
    const width = Number(/^(\d+)px$/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    expect(Number.isNaN(width)).toBe(false);
    // Nav memakai px-1 = 4px per sisi, jadi 8px terpakai sebelum isi item.
    const inner = width - 8;
    expect(inner).toBeGreaterThanOrEqual(COMPACT_ICON_SIZE + 20);
  });

  it("tidak negatif dan tidak nol", () => {
    const width = Number(/^(\d+)px$/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    expect(width).toBeGreaterThan(0);
  });
});

/**
 * Rail tidak boleh ikut lebar main pane. Ini dulu terjadi karena
 * `gridTemplateColumns` diberi string `"lg 70px 1fr"` -- `lg` bukan token CSS,
 * jadi browser membuang seluruh deklarasi dan kolom fallback ke `auto`, yang
 * menyerap sisa ruang. Makin lebar main pane, makin lebar rail.
 */
/**
 * Ukuran ikon rail compact ada di tiga tempat (item navigasi, pengaturan,
 * keluar). Nilainya lewat satu konstanta supaya tidak ada ikon yang tertinggal
 * ukuran lama kalau satu komponen diubah.
 */
describe("COMPACT_ICON_SIZE", () => {
  it("18px", () => {
    expect(COMPACT_ICON_SIZE).toBe(18);
  });

  it("kelas Tailwind diturunkan dari konstanta, bukan angka terpisah", () => {
    expect(COMPACT_ICON_CLASS).toBe(`size-[${COMPACT_ICON_SIZE}px]`);
  });

  it("tidak ada ikon rail compact yang memakai ukuran lain", () => {
    const sidebar = readFileSync(
      join(process.cwd(), "src/components/layout/compact-sidebar.tsx"),
      "utf8",
    );
    // Kalau ada literal size-[Npiksel] yang tersisa selain yang di konstanta,
    // ada ikon yang luput diubah dan ukurannya jadi tidak seragam.
    const literals = sidebar.match(/size-\[(\d+)px\]/g) ?? [];
    const stray = literals.filter((l) => l !== COMPACT_ICON_CLASS);
    expect(stray).toEqual([]);
  });
});

describe("COMPACT_GRID_TEMPLATE", () => {
  it("tanpa prefix breakpoint Tailwind", () => {
    // `lg:` hanya bermakna di nama kelas, tidak di nilai inline style.
    expect(COMPACT_GRID_TEMPLATE).not.toMatch(/(^|\s)(sm|md|lg|xl|2xl)[\s:]/);
  });

  it("kolom rail adalah panjang tetap, bukan auto atau fraksi", () => {
    const [rail] = COMPACT_GRID_TEMPLATE.split(/\s+/);
    expect(rail).toBe(COMPACT_RAIL_WIDTH);
    expect(rail).toMatch(/^\d+px$/);
    expect(rail).not.toBe("auto");
  });

  it("kolom konten minmax(0, 1fr) supaya tidak menggantung keluar grid", () => {
    expect(COMPACT_GRID_TEMPLATE).toBe(`${COMPACT_RAIL_WIDTH} minmax(0, 1fr)`);
  });
});

/**
 * Menu/body rail dipusatkan vertikal, dan yang dijaga di sini adalah kata
 * `safe`-nya, bukan pusatnya.
 *
 * `nav` itu `overflow-y-auto`. `justify-center` tanpa `safe` adalah bug yang
 * tidak kelihatan di kode dan tidak ketangkap test mana pun: begitu jumlah item
 * melewati tinggi viewport -- label tiga baris di rail sempit, atau jendela
 * pendek -- flex memusatkan content, bagian atasnya terdorong keluar dari area
 * scroll, dan user tidak pernah bisa menggulir ke halaman atas. Tidak ada error,
 * tidak ada dokumen yang salah, dan hampir tidak ada yang menguji halaman atas
 * sidebar.
 *
 * Jadi assertion di sini sengaja memakai tag `<nav>`-nya, bukan seluruh file: kalau
 * kelasnya dipindah ke elemen lain, atau `safe`-nya dihapus, test ini harus
 * merah.
 */
describe("pusat vertikal menu rail compact", () => {
  const source = readFileSync(join(__dirname, "compact-sidebar.tsx"), "utf8");
  const navTag = source.match(/<nav[^>]*>/)?.[0] ?? "";

  it("tag nav ditemukan, kalau tidak guard di bawah jadi sia-sia", () => {
    expect(navTag).not.toBe("");
  });

  it("memakai justify-center-safe, bukan justify-center biasa", () => {
    expect(navTag).toContain("justify-center-safe");
    // Guard eksplisit: `justify-center` polos itu bug overflow di atas.
    expect(navTag).not.toMatch(/(?<!-safe )justify-center(?!-safe)/);
  });

  it("nav tetap bisa digulir, jadi memusatkan tidak boleh mengorbankan overflow", () => {
    // Kalau `overflow-y-auto` hilang bersamaan dengan pemusatan, tidak ada
    // kontak visual antara dua keputusan ini -- tapi keduanya satu perubahan.
    expect(navTag).toContain("overflow-y-auto");
    expect(navTag).toContain("flex-1");
  });
});
