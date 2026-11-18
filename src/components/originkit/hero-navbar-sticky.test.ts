import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);

describe("navbar landing sticky + morph", () => {
  it("tinggi, radius, dan padding navbar dijaga saat morph", () => {
    expect(source).toMatch(/mx-auto flex h-\[70px\] w-full max-w-\[calc\(995px/);
    expect(source).toMatch(
      /rounded-\[11px\] border border-solid border-\[#dee5ed\] bg-white p-\[calc\(12px_\+_var\(--nav-morph,0\)\*8px\)\]/,
    );
    expect(source).toMatch(/hidden h-9 w-11 shrink-0 .* rounded-\[7px\] bg-\[#2563eb\]/);
  });

  it("navbar sticky dengan gap atas dan melebar sampai 100% viewport saat morph", () => {
    expect(source).toContain('className="relative sticky top-4 z-40 w-full"');
    expect(source).toContain("morph={morph}");
    expect(source).toMatch(
      /max-w-\[calc\(995px_\+_var\(--nav-morph,0\)\*\(100vw_-_995px\)\)\]/,
    );
    expect(source).toMatch(/lg:max-w-\[calc\(800px_\+_var\(--nav-morph,0\)\*\(100vw_-_800px\)\)\]/);
  });

  it("fill dan outline navbar tidak memudar, tanpa progressive blur", () => {
    expect(source).not.toMatch(/backgroundColor: `rgba\(255, 255, 255, \$\{1 - morph\}\)`/);
    expect(source).not.toMatch(/borderColor: `rgba\(15, 23, 42/);
    expect(source).not.toContain("ProgressiveBlur");
    expect(source).toMatch(/style=\{\{ "--nav-morph": morph \} as CSSProperties\}/);
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
