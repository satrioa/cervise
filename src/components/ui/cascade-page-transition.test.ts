import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("overlay tidak menelan klik", () => {
  it("panel transisi bersifat dekoratif (pointer-events-none)", () => {
    const source = read("src/components/ui/CascadePageTransition.tsx");
    expect(source).not.toContain("pointer-events-auto");
    expect(source).toContain("pointer-events-none relative flex flex-1");
  });

  it("backdrop sheet melepaskan klik saat animasi tutup", () => {
    const source = read("src/components/ui/sheet.tsx");
    expect(source).toContain("data-ending-style:pointer-events-none");
  });

  it("transisi mengembalikan pointer events body yang tertinggal", () => {
    // Base UI memberi body.style.pointerEvents = 'none' saat overlay modal
    // terbuka. Kalau overlay unmount saat transisi, cleanup bisa terlewat dan
    // seluruh halaman jadi mati sampai di-refresh.
    const source = read("src/components/layout/page-transition.tsx");
    expect(source).toContain('document.body.style.pointerEvents = ""');
    expect(source).toContain('window.addEventListener("kaggo:transition"');
    expect(source).toContain('window.removeEventListener("kaggo:transition"');
  });
});
