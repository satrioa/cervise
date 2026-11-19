import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Di layar kecil hero hanya boleh menampilkan satu HP dan CTA. Kartu mengapung
 * dan orb saling menimpa di lebar <768px, jadi keduanya harus tersembunyi
 * lewat breakpoint, bukan sekadar diperkecil.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("mockup hero di mobile", () => {
  it("menyembunyikan kartu mengapung dan orb di bawah md", () => {
    const source = read("src/components/originkit/hero-02.tsx");
    const layer = source.match(/<div className="pointer-events-none absolute inset-0 z-40[^"]*"/)?.[0];
    expect(layer).toBeDefined();
    expect(layer).toContain("hidden");
    expect(layer).toContain("md:block");
  });

  it("hanya menampilkan HP aktif dan memakai tinggi mobile yang lebih pendek", () => {
    const source = read("src/components/phone-carousel.tsx");
    expect(source).toMatch(/hidden md:block/);
    expect(source).toContain("h-[520px] md:h-[560px] lg:h-[590px]");
  });
});
