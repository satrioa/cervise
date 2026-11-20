import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-dock-nav.tsx"),
  "utf8",
);

describe("dock mobile tema normal", () => {
  it("terang di light mode dan gelap di dark mode", () => {
    expect(source).toContain("bg-white/95");
    expect(source).toContain("dark:bg-neutral-900/95");
    expect(source).toContain("ring-black/5");
    expect(source).toContain("dark:ring-white/10");
    // Urutan invers (gelap di light, terang di dark) tidak boleh kembali.
    expect(source).not.toMatch(/["' ]bg-neutral-900\/95/);
    expect(source).not.toContain("dark:bg-white/95");
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

  it("warna teks mengikuti tema halaman", () => {
    expect(source).toContain("text-neutral-500 hover:text-neutral-900");
    expect(source).toContain("dark:text-neutral-400 dark:hover:text-white");
  });
});
