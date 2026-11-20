import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-dock-nav.tsx"),
  "utf8",
);

describe("dock mobile tema normal", () => {
  it("wrap transparan dengan fade hitam di belakangnya", () => {
    expect(source).toMatch(/bg-gradient-to-t from-black\/40 via-black\/20 to-transparent/);
    expect(source).not.toContain("bg-white/95");
    expect(source).not.toContain("dark:bg-neutral-900/95");
    expect(source).not.toContain("ring-black/5");
    expect(source).not.toContain("dark:ring-white/10");
  });

  it("tombol menu candy putih ber-radius tanpa label dan tanpa shadow", () => {
    expect(source).toContain('variant="candy"');
    expect(source).toMatch(/\[--btn:#fff\]/);
    expect(source).toMatch(/rounded-xl/);
    expect(source).toMatch(/size-14/);
    expect(source).toMatch(/shadow-none \[&_svg\]:drop-shadow-none/);
    expect(source).not.toMatch(/\{item\.label\}<\/span>/);
  });

  it("ikon aktif di-fill, ikon non-aktif berbentuk line", () => {
    expect(source).toMatch(/fill=\{active \? "currentColor" : "none"\}/);
  });

  it("ikon dan label hitam saat normal, biru saat aktif, tanpa opacity", () => {
    expect(source).toMatch(/\[--btn-fg:#111827\]/);
    expect(source).toMatch(/active \? "\[--btn-fg:var\(--color-brand\)\] dark:\[--btn-fg:#93C5FD\]" : ""/);
    expect(source).not.toMatch(/opacity-80/);
  });

  it("dark mode memakai tombol gelap, teks terang, dan aktif biru muda", () => {
    expect(source).toMatch(/dark:\[--btn:#1f2937\]/);
    expect(source).toMatch(/dark:\[--btn-fg:#e5e7eb\]/);
    expect(source).toMatch(/dark:\[--btn-fg:#93C5FD\]/);
  });

  it("menu berdekatan dan fade hitam lembut", () => {
    expect(source).toMatch(/justify-center gap-3/);
    expect(source).toMatch(/from-black\/40 via-black\/20 to-transparent/);
  });

  it("melekat di bawah tanpa radius", () => {
    expect(source).toContain("fixed inset-x-0 bottom-0 z-30");
    expect(source).toContain("lg:hidden");
    expect(source).not.toContain("rounded-full");
    expect(source).not.toMatch(/px-3 pb-\[max/);
  });

  it("gap bawah lebih besar dari gap atas", () => {
    expect(source).toContain("pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]");
  });
});
