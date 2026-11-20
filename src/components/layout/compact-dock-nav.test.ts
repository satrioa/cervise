import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-dock-nav.tsx"),
  "utf8",
);

describe("dock mobile tema normal", () => {
  it("wrap transparan dengan fade hitam di belakangnya", () => {
    expect(source).toMatch(/bg-gradient-to-t from-black\/70 via-black\/40 to-transparent/);
    expect(source).not.toContain("bg-white/95");
    expect(source).not.toContain("dark:bg-neutral-900/95");
    expect(source).not.toContain("ring-black/5");
    expect(source).not.toContain("dark:ring-white/10");
  });

  it("tombol menu candy putih berbentuk kotak dengan label di dalam", () => {
    expect(source).toContain('variant="candy"');
    expect(source).toContain('shape="square"');
    expect(source).toMatch(/\[--btn:#fff\]/);
    expect(source).toMatch(/\[--btn-fg:var\(--color-brand\)\]/);
    expect(source).toMatch(/size-14 flex-col/);
    expect(source).toMatch(/<span className="max-w-full truncate">\{item\.label\}<\/span>/);
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

  it("ikon dan label memakai warna brand di atas permukaan putih", () => {
    expect(source).toContain("--btn-fg:var(--color-brand)");
    expect(source).toMatch(/active \? "opacity-100" : "opacity-80"/);
  });
});
