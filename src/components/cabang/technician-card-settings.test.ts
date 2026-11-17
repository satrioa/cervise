import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/app/cabang/actions.ts"), "utf8");
const drawer = readFileSync(join(process.cwd(), "src/components/cabang/cabang-drawer.tsx"), "utf8");

describe("cabang technician card settings", () => {
  it("reads and writes the four new branch columns", () => {
    for (const column of [
      "target_type",
      "target_value",
      "show_target_to_teknisi",
      "show_intensif_to_teknisi",
    ]) {
      expect(actions).toContain(column);
    }
    expect(actions).toContain("export async function updateCabangTarget");
    expect(actions).toContain("export async function updateCabangCardVisibility");
  });

  it("exposes both visibility toggles and the target card in the drawer", () => {
    expect(drawer).toContain("show_intensif_to_teknisi");
    expect(drawer).toContain("show_target_to_teknisi");
    expect(drawer).toContain("Target Cabang");
    expect(drawer).toContain("Penghasilan");
    expect(drawer).toContain("Jumlah Servis");
  });
});
