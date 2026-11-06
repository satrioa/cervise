import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/components/penjualan/penjualan-payment-panel.tsx", "utf8");

/**
 * Panel ini pernah gagal karena kelas Tailwind dirangkai dinamis, jadi kelas
 * grid-nya tidak pernah di-generate. Yang dijaga di sini hanya perilaku yang
 * mudah rusak lagi saat dirapikan.
 */
describe("panel pembayaran penjualan", () => {
  it("memakai kelas grid statis, bukan rangkaian string", () => {
    expect(SOURCE).not.toMatch(/className=\{[^}]*"\s*\+/);
    expect(SOURCE).toContain("grid-cols-[minmax(0,1fr)]");
    expect(SOURCE).toContain("@lg:grid-cols-[minmax(0,16rem)_1fr]");
  });

  it("metode terpilih ditandai aria-pressed tanpa border-2", () => {
    expect(SOURCE).toContain("aria-pressed={selected}");
    expect(SOURCE).not.toContain("border-2");
  });

  it("kembalian hanya untuk tunai, kurang ditampilkan saat uang belum cukup", () => {
    expect(SOURCE).toContain('metode === "Tunai" && cashDigits !== ""');
    expect(SOURCE).toContain("shortfall > 0");
    expect(SOURCE).toContain('"Kurang"');
  });

  it("subtotal digabung ke total saat angkanya sama", () => {
    expect(SOURCE).toContain("const hasDifference = subtotal !== total");
    expect(SOURCE).toContain("{hasDifference && (");
  });
});
