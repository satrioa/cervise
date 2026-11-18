import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);

describe("navbar landing sticky + morph", () => {
  it("navbar menempel di atas dan lebar menyusut sesuai morph", () => {
    expect(source).toContain('className="sticky top-0 z-40 w-full"');
    expect(source).toContain("morph={morph}");
    expect(source).toMatch(/max-w-\[calc\(995px_-_var\(--nav-morph,0\)\*395px\)\]/);
  });

  it("morph selesai saat badge menyentuh atas viewport", () => {
    expect(source).toContain("badgeRef");
    expect(source).toMatch(/morphStartRef\.current = Math\.max\(1, top\)/);
    expect(source).toMatch(/\(start - top\) \/ start/);
  });

  it("tidak ada ancestor overflow-hidden yang membatasi sticky", () => {
    expect(source).not.toMatch(/className="relative w-full h-full overflow-hidden bg-white/);
    expect(source).toContain("overflow-clip rounded-b-");
  });
});
