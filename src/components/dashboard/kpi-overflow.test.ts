import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), "utf8");

const bento = read("src/components/dashboard/bento-card.tsx");
const technician = read("src/components/dashboard/technician-dashboard.tsx");
const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const ownerDashboard = read("src/app/app/dashboard-owner-client.tsx");
const salesReport = read("src/app/app/laporan/penjualan/laporan-penjualan-client.tsx");
const performanceReport = read("src/app/app/laporan/performa/laporan-performa-client.tsx");
const ownerPage = read("src/app/owner/page.tsx");
const accountsPage = read("src/app/owner/accounts/page.tsx");

describe("KPI card tidak meluber di mobile", () => {
  it("grid item tidak boleh melebar dari kolomnya", () => {
    expect(bento).toMatch(/\[&>\*\]:min-w-0/);
    expect(bento).toMatch(/min-h-0 w-full min-w-0 flex-col overflow-hidden/);
  });

  it("angka besar diskalakan dan dipotong di layar kecil", () => {
    expect(technician).toMatch(/truncate text-4xl .* tabular-nums sm:text-6xl/);
    expect(technician).toMatch(/break-all text-\[clamp\(0\.875rem,4vw,1\.5rem\)\]/);
    expect(technician).toMatch(/break-all text-\[clamp\(1rem,5vw,1\.875rem\)\]/);
  });

  it("nilai nominal pada baris rekap tidak menimpa label", () => {
    const rows = frontliner.slice(frontliner.indexOf("function TotalRow"));
    expect(rows).toMatch(/min-w-0 truncate text-right font-medium tabular-nums/);
  });

  it("kartu KPI master admin & laporan memotong nominal panjang", () => {
    const clamp = /min-w-0 truncate font-heading text-\[clamp\(1rem,5vw,1\.875rem\)\]/;
    expect(ownerDashboard).toMatch(clamp);
    expect(ownerDashboard).toMatch(/min-w-0 overflow-hidden rounded-xl border/);
    expect(salesReport).toMatch(/min-w-0 truncate font-heading text-\[clamp\(1rem,5vw,1\.5rem\)\]/);
    expect(performanceReport).toMatch(/min-w-0 truncate font-heading text-\[clamp\(1rem,5vw,1\.5rem\)\]/);
    expect(ownerPage).toMatch(clamp);
    expect(accountsPage).toMatch(clamp);
  });
});
