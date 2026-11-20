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

  it("minimum slider mengikuti kapasitas Starter dari konfigurasi", () => {
    expect(source).toMatch(/\["branches", "Jumlah cabang", config\?\.includedBranches \?\? 1/);
    expect(source).toMatch(/\["employees", "Karyawan aktif", config\?\.includedEmployees \?\? 5/);
    expect(source).toMatch(/\["services", "Tiket servis \/ bulan", config\?\.includedServices \?\? 100/);
  });

  it("kartu Custom menampilkan teks Custom, bukan angka", () => {
    expect(source).toMatch(/if \(pkg\.code === "custom"\) return \{ amount: null, cadence: "Custom" \}/);
    expect(source).toMatch(/amount === null\s*\?\s*"Custom"/);
  });

  it("label hemat tahunan Custom pakai persentase", () => {
    expect(source).toMatch(/isCustom\s*\?\s*`Hemat \$\{savingsPercent\}%`/);
  });

  it("poin kapasitas kartu tidak memuat angka", () => {
    const body = source.slice(source.indexOf("function featuresOf"), source.indexOf("export function PricingThreeTier"));
    expect(body).not.toMatch(/\$\{pkg\.(branch_limit|user_limit|ticket_quota|whatsapp_quota)/);
  });

  it("layout desktop dua kolom dengan input bertumpuk di kiri", () => {
    expect(source).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
    expect(source).toMatch(/<div className="flex flex-col gap-5">/);
  });

  it("kalkulator punya tab Bulanan/Tahunan dengan state terpisah", () => {
    expect(source).toMatch(/useState<Period>\("monthly"\)/);
    expect(source).toMatch(/calculatorPeriod/);
    expect(source).toMatch(/calculatorPeriod === "annual" \? previewAnnual : preview\.total/);
  });
});

describe("tabel perbandingan paket", () => {
  it("menampilkan fitur utama platform sebagai baris centang", () => {
    for (const label of [
      "POS",
      "Manajemen Sparepart",
      "Manajemen Inventori",
      "Portal Lacak Servis",
      "Laporan Keuangan & Servis",
    ]) {
      expect(source, label).toContain(label);
    }
    expect(source).toMatch(/FEATURE_ROWS/);
  });
});
