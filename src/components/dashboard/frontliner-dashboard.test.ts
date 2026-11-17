import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "components", "dashboard", "frontliner-dashboard.tsx"),
  "utf8",
);

/**
 * Dialog Pengambilan Device dipasang di viewport HP. `DialogContent` memakai
 * `display: grid`; anak grid punya `min-width: auto` secara default, jadi
 * teks/service number yang panjang bisa memaksa grid melebar lalu terpotong.
 */
describe("dialog pengambilan device responsif di mobile", () => {
  it("lebar dialog mengikuti viewport tanpa memotong konten", () => {
    expect(source).toMatch(
      /<DialogContent className="max-h-\[90vh\] w-\[calc\(100vw-2rem\)\] min-w-0 !max-w-md overflow-y-auto">/,
    );
    // overflow-x-hidden menyembunyikan konten yang kelebar; perbaikan harus
    // membuat konten menyusut/membungkus, bukan memotongnya.
    expect(source).not.toContain("overflow-x-hidden");
  });

  it("anak grid dan baris pencarian bisa menyusut", () => {
    expect(source).toContain('<DialogHeader className="min-w-0">');
    expect(source).toContain('<div className="min-w-0 space-y-3">');
    expect(source).toContain('<div className="flex min-w-0 gap-2">');
    expect(source).toContain('<div className="min-w-0 max-h-[280px] overflow-y-auto scrollbar-thin">');
  });

  it("teks panjang dan tombol boleh membungkus", () => {
    expect(source).toContain('<div className="flex flex-wrap justify-end gap-2 pt-2">');
    expect(source).toMatch(/mt-1 block break-words text-xs opacity-60/);
  });
});
