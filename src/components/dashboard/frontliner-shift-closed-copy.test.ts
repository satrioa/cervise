import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), "utf8");

const dashboard = read("src/components/dashboard/frontliner-dashboard.tsx");
const homeData = read("src/lib/home/home-data.ts");
const homeAction = read("src/app/app/actions/home.ts");
const types = read("src/lib/home/types.ts");

describe("kalimat shift tertutup di Home FL", () => {
  it("tidak lagi memakai 'hari ini' yang ambigu dengan cutoff 03.00", () => {
    expect(dashboard).not.toContain("Shift hari ini sudah ditutup");
    expect(dashboard).toContain("Shift sebelumnya ditutup");
    expect(dashboard).toMatch(/pukul \$\{lastClosedTime\}/);
  });

  it("menyebut 'oleh sistem' hanya untuk penutupan cutoff", () => {
    expect(dashboard).toMatch(/lastClosedAuto \? " oleh sistem" : ""/);
    expect(homeData).toMatch(/closedByName === "Sistem"/);
    expect(homeData).toMatch(/closed_at, closing_balance, snapshot/);
  });

  it("waktu tutup dan flag auto diteruskan sampai dashboard", () => {
    for (const field of ["lastClosedAt", "lastClosedAuto"]) {
      expect(types).toContain(field);
      expect(homeData).toContain(field);
      expect(homeAction).toContain(field);
      expect(dashboard).toContain(field);
    }
  });
});
