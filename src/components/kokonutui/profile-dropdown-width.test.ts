import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("lebar panel profil", () => {
  const source = read("src/components/kokonutui/profile-dropdown.tsx");

  it("bisa mengikuti lebar tombol trigger", () => {
    expect(source).toMatch(/panelWidth\?: number \| "trigger"/);
    expect(source).toMatch(/panelWidth === "trigger"/);
    expect(source).toMatch(/const panelW =/);
    expect(source).not.toMatch(/style=\{\{ width: PANEL_W \}\}/);
  });

  it("sheet mobile meminta panel selebar trigger", () => {
    const sheet = read("src/components/layout/compact-menu-sheet.tsx");
    expect(sheet).toMatch(/panelWidth="trigger"/);
  });
});
