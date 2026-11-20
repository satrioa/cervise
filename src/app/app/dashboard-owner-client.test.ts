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
    expect(source).toContain("dibandingkan kemarin");
    expect(source).not.toContain("Keluar ${formatCurrencyPlain(summary.pengeluaran)}");
  });

  it("mengambil omzet periode sebelumnya dari server", () => {
    expect(actions).toContain("previousOmzet");
    expect(actions).toContain("previousPeriodStart");
  });
});
