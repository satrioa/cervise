import { describe, expect, it } from "vitest";
import { COMPACT_GRID_TEMPLATE, COMPACT_RAIL_WIDTH } from "./compact-sidebar";

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
    expect(width - 8).toBeGreaterThanOrEqual(48);
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
