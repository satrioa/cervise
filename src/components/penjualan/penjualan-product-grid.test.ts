import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/penjualan/penjualan-product-grid.tsx"),
  "utf8",
);

describe("detail kartu produk", () => {
  it("slide dari bawah dengan easing spring hanya di mobile", () => {
    expect(source).toMatch(/transition-transform duration-300 ease-\[linear\(0,0\.35,0\.85,1\.06,1\.02,0\.995,1\)\]/);
    expect(source).toMatch(/max-sm:data-\[starting-style\]:translate-y-full/);
    expect(source).toMatch(/max-sm:data-\[ending-style\]:translate-y-full/);
    expect(source).toMatch(/sm:-translate-y-1\/2/);
  });

  it("konten detail punya gap bawah aman dari gesture bar HP", () => {
    expect(source).toMatch(/pb-\[calc\(1\.5rem\+env\(safe-area-inset-bottom\)\)\] sm:pb-4/);
  });
});
