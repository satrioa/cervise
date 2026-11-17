import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dash = readFileSync(join(process.cwd(), "src/components/dashboard/technician-dashboard.tsx"), "utf8");
const home = readFileSync(join(process.cwd(), "src/lib/home/home-data.ts"), "utf8");
const types = readFileSync(join(process.cwd(), "src/lib/home/types.ts"), "utf8");

describe("technician home cards", () => {
  it("renders two independent cards", () => {
    expect(dash).toContain("function TargetCabangTile");
    expect(dash).toContain("function IntensifTile");
    expect(dash).toContain("technicianCardFlags");
    expect(dash).not.toContain("Cabang ini memakai insentif per servis");
  });

  it("uses span 1 for two cards and span 2 for one", () => {
    expect(dash).toMatch(/showTarget && showIntensif[\s\S]*span=\{1\}/);
    expect(dash).toMatch(/span=\{2\}/);
  });

  it("loads the new branch columns into cards payload", () => {
    for (const c of ["target_type", "target_value", "show_target_to_teknisi", "show_intensif_to_teknisi"]) {
      expect(home).toContain(c);
    }
    expect(types).toContain("cards:");
  });
});
