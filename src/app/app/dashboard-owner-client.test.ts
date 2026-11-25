import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/dashboard-owner-client.tsx"),
  "utf8",
);

const actions = readFileSync(
  join(process.cwd(), "src/app/app/actions.ts"),
  "utf8",
);

describe("KPI Omzet dashboard owner", () => {
  it("filter periode langsung tampil tanpa tombol di mobile", () => {
    expect(source).toContain("filtersAlwaysVisible");
  });

  it("menampilkan trend perubahan dibanding periode sebelumnya", () => {
    expect(source).toMatch(/Naik|Turun/);
    expect(source).toContain("vs kemarin");
    expect(source).toContain("vs ${PERIOD_LABEL[period]} lalu");
    expect(source).not.toContain("Keluar ${formatCurrencyPlain(summary.pengeluaran)}");
  });

  it("meta KPI satu baris tanpa pill warna-warni", () => {
    expect(source).not.toContain('trend: "up"');
    expect(source).not.toContain('trend: "down"');
    expect(source).not.toContain("dibanding ${PERIOD_LABEL[period]} sebelumnya");
    expect(source).toContain("tone: \"neutral\" as const");
    expect(source).toContain("<span className=\"truncate\">{meta}</span>");
    expect(source).toContain("mt-0.5 truncate text-xs text-muted-foreground/70");
  });

  it("mengambil omzet periode sebelumnya dari server", () => {
    expect(actions).toContain("previousOmzet");
    expect(actions).toContain("previousPeriodStart");
  });
});

describe("KPI Piutang dashboard owner", () => {
  it("kartu piutang memakai saldo berjalan dari server", () => {
    expect(source).toContain('label: "Piutang"');
    expect(source).toContain("formatCurrencyPlain(summary.piutang)");
    expect(source).toContain('sub: "saldo berjalan"');
    expect(actions).toContain("piutangSales");
  });

  it("grid kartu mendukung lima KPI", () => {
    expect(source).toContain("xl:grid-cols-5");
    expect(source).toContain("Array.from({ length: 5 }");
  });
});
