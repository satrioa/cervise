import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("spacing shell compact mobile", () => {
  it("main tidak menyisakan space besar di bawah bar identitas", () => {
    const shell = read("src/components/layout/compact-shell.tsx");
    expect(shell).toMatch(/pt-\[calc\(3\.25rem_\+_env\(safe-area-inset-top\)\)\]/);
    expect(shell).not.toMatch(/pt-\[calc\(5\.5rem_\+_env\(safe-area-inset-top\)\)\]/);
  });

  it("dock berada di bawah action bar dalam stacking order", () => {
    expect(read("src/components/layout/compact-dock-nav.tsx")).toMatch(
      /fixed inset-x-0 bottom-0 z-30/,
    );
  });

  it("dock menyisakan gap 16px di dalam, kiri dan kanan", () => {
    expect(read("src/components/layout/compact-dock-nav.tsx")).toMatch(/gap-2 px-4 pt-2/);
    expect(read("src/components/layout/compact-dock-nav.tsx")).not.toMatch(/px-8/);
  });

  it("action bar memakai jarak aman dock", () => {
    for (const file of [
      "src/app/app/servis/page.tsx",
      "src/components/settings-appearance.tsx",
      "src/components/settings-profile.tsx",
      "src/components/settings-localization.tsx",
      "src/components/penjualan/penjualan-cart-panel.tsx",
    ]) {
      expect(read(file), file).toContain("bottom-[var(--dock-clearance)]");
    }
    expect(read("src/app/globals.css")).toMatch(
      /--dock-clearance: calc\(4\.5rem \+ env\(safe-area-inset-bottom\)\)/,
    );
  });
});
