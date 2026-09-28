import { describe, expect, it } from "vitest";
import { COMPACT_RAIL_WIDTH } from "./compact-sidebar";

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

  it("piksel tetap, bukan clamp — diukur dari DevTools", () => {
    expect(COMPACT_RAIL_WIDTH).toBe("74px");
  });

  it("cukup untuk ikon di atas label dua baris", () => {
    const width = Number(/^(\d+)px$/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    expect(Number.isNaN(width)).toBe(false);
    // px-2 = 8px per sisi, jadi 16px terpakai sebelum isi item.
    const inner = width - 16;
    expect(inner).toBeGreaterThanOrEqual(50);
  });

  it("tidak negatif dan tidak nol", () => {
    const width = Number(/^(\d+)px$/.exec(COMPACT_RAIL_WIDTH)?.[1]);
    expect(width).toBeGreaterThan(0);
  });
});
