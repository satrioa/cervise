import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const component = read("src/components/layout/landing-smooth-scroll.tsx");
const landingPage = read("src/app/page.tsx");

describe("landing smooth scroll", () => {
  it("hanya dipasang di halaman landing", () => {
    expect(landingPage).toContain("LandingSmoothScroll");

    for (const path of ["src/app/layout.tsx", "src/components/layout/app-shell.tsx", "src/components/layout/compact-shell.tsx"]) {
      expect(read(path)).not.toContain("LandingSmoothScroll");
    }
  });

  it("mengaktifkan anchor, autoRaf, dan membersihkan instance saat unmount", () => {
    expect(component).toContain("new Lenis(");
    expect(component).toContain("autoRaf: true");
    expect(component).toContain("anchors: true");
    expect(component).toContain("lenis.destroy()");
  });

  it("tidak mengaktifkan smooth touch (native touch dipertahankan)", () => {
    expect(component).toContain("syncTouch: false");
  });
});
