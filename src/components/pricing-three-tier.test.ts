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

  it("kalkulator hanya punya slider jumlah cabang", () => {
    const calculator = source.slice(source.indexOf('id="kalkulator-custom"'));
    expect(source).toMatch(/\["branches", "Jumlah cabang", config\?\.includedBranches \?\? 1/);
    expect(calculator).not.toContain("Karyawan aktif");
    expect(calculator).not.toContain("Tiket servis / bulan");
    expect(calculator).not.toContain("<span>Karyawan</span>");
    expect(calculator).not.toContain("<span>Tiket / bulan</span>");
    expect(calculator).not.toContain("Tambah karyawan");
    expect(calculator).not.toContain("blok tiket");
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

  it("tab berada di dalam kartu hasil, di atas baris Cabang", () => {
    const card = source.indexOf('className="rounded-xl border p-4 text-sm"');
    const tabs = source.indexOf("<Tabs", card);
    const cabang = source.indexOf("<span>Cabang</span>", card);
    expect(card).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(card);
    expect(tabs).toBeLessThan(cabang);
  });

  it("tab memakai lebar penuh kartu hasil", () => {
    expect(source).toMatch(/<TabsList className="w-full">/);
  });
});

describe("tabel perbandingan paket", () => {
  it("dibungkus Card dengan header dan panel", () => {
    expect(source).toMatch(/import \{[\s\S]*?Card,[\s\S]*?CardHeader,[\s\S]*?CardPanel[\s\S]*?\} from "@\/components\/ui\/card"/);
    expect(source).toMatch(/<Card className="mt-16">/);
    expect(source).toMatch(/<CardHeader>/);
    expect(source).toMatch(/<CardPanel/);
  });

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

  it("menuliskan 'custom' untuk nilai kapasitas Pay as You Grow", () => {
    expect(source).toMatch(/p\.code === "custom" \? "custom"/);
  });

  it("tidak menampilkan baris Durasi trial", () => {
    expect(source).not.toContain('"Durasi trial"');
  });
});
