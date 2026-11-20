import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/pricing-three-tier.tsx"),
  "utf8",
);

describe("kalkulator Pay as You Grow", () => {
  it("memakai slider, bukan tombol plus/minus atau input angka", () => {
    expect(source).toMatch(/import \{ Slider \} from "@\/components\/ui\/slider"/);
    expect(source).toMatch(/<Slider/);
    expect(source).not.toMatch(/aria-label=\{`Kurangi/);
    expect(source).not.toMatch(/type="number"/);
  });

  it("slider mulai dari 1 cabang, 1 karyawan, 0 tiket", () => {
    expect(source).toMatch(/\["branches", "Jumlah cabang", 1, 30, 1/);
    expect(source).toMatch(/\["employees", "Karyawan aktif", 1, 100, 1/);
    expect(source).toMatch(/\["services", "Tiket servis \/ bulan", 0, 5000, 100/);
  });

  it("kartu Custom menampilkan teks Custom, bukan angka", () => {
    expect(source).toMatch(/if \(pkg\.code === "custom"\) return \{ amount: null, cadence: "Custom" \}/);
    expect(source).toMatch(/amount === null\s*\?\s*"Custom"/);
  });

  it("layout desktop dua kolom dengan input bertumpuk di kiri", () => {
    expect(source).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
    expect(source).toMatch(/<div className="flex flex-col gap-5">/);
  });
});
