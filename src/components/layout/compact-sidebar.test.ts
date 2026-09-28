import { describe, expect, it } from "vitest";
import { COMPACT_RAIL_WIDTH } from "./compact-sidebar";

/**
 * `COMPACT_RAIL_WIDTH` masuk ke `gridTemplateColumns` sebagai nilai mentah, bukan
 * lewat kelas Tailwind. Kalau formatnya salah, grid itu tidak error — kolom
 * pertama diam-diam jatuh ke `auto` dan rail melebar mengikuti konten. Jadi
 * bentuk stringnya perlu dijaga.
 */
describe("COMPACT_RAIL_WIDTH", () => {
  it("memakai clamp() agar lebar benar-benar proporsional", () => {
    expect(COMPACT_RAIL_WIDTH).toMatch(
      /^clamp\(\d+px,\s*[\d.]+vw,\s*\d+px\)$/,
    );
  });

  it("batas bawah cukup memuat item dengan padding 8px per sisi", () => {
    const min = Number(/clamp\((\d+)px/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    // px-2 = 8px per sisi, jadi 16px terpakai sebelum isi item.
    expect(min).toBeGreaterThanOrEqual(56);
  });

  it("batas atas tidak lebih besar dari versi terakhir yang dianggap wajar", () => {
    const max = Number(/,\s*(\d+)px\)$/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    expect(max).toBeLessThanOrEqual(72);
  });

  it("nilai tengah benar-benar berbasis lebar layar", () => {
    // Angka tetap tidak pernah bergerak; vw itulah yang membuat rail ikut
    // menyusut relatif saat konten melebar.
    expect(COMPACT_RAIL_WIDTH).toContain("vw");
  });

  it("tanpa spasi ganda atau koma menggantung", () => {
    expect(COMPACT_RAIL_WIDTH).not.toMatch(/\s{2,}/);
    expect(COMPACT_RAIL_WIDTH.endsWith(")")).toBe(true);
  });
});
