import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-dock-nav.tsx"),
  "utf8",
);

describe("dock mobile invers tema", () => {
  it("gelap di light mode dan terang di dark mode", () => {
    expect(source).toContain("bg-neutral-900/95");
    expect(source).toContain("dark:bg-white/95");
    expect(source).toContain("ring-white/10");
    expect(source).toContain("dark:ring-black/5");
    // Urutan lama (putih di light, gelap di dark) tidak boleh kembali.
    expect(source).not.toContain("bg-white/95 p-1.5");
    expect(source).not.toContain("dark:bg-neutral-900/95");
  });

  it("warna teks mengikuti warna dock", () => {
    expect(source).toContain("text-neutral-400 hover:text-white");
    expect(source).toContain("dark:text-neutral-500 dark:hover:text-neutral-900");
  });
});
