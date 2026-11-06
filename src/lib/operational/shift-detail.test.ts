import { describe, expect, it } from "vitest";
import type { ShiftReport } from "./laporan-shift";
import { shiftBreakdown, shiftClock, shiftDateLabel, shiftDuration } from "./shift-detail";

function report(overrides: Partial<ShiftReport> = {}): ShiftReport {
  return {
    schemaVersion: 2,
    branchName: "Cabang Pusat",
    employeeName: "Rina",
    date: "2026-10-24",
    openAt: "2026-10-24T01:14:00.000Z",
    closingAt: "2026-10-24T06:26:00.000Z",
    openingBalance: 500_000,
    closingBalance: null,
    expectedCash: 1_250_000,
    variance: null,
    reason: null,
    services: [],
    sales: [],
    cashTx: [],
    totals: {
      services: 400_000,
      sales: 350_000,
      manualIn: 0,
      manualOut: 0,
      manualNet: 0,
      expected: 1_250_000,
    },
    ...overrides,
  };
}

describe("shiftDuration", () => {
  it("memformat menit jadi jam dan menit", () => {
    expect(shiftDuration(312)).toBe("5j 12m");
    expect(shiftDuration(45)).toBe("0j 45m");
    expect(shiftDuration(120)).toBe("2j 0m");
  });

  it("durasi tidak diketahui jadi null, bukan '0j 0m'", () => {
    expect(shiftDuration(undefined)).toBeNull();
    expect(shiftDuration(null)).toBeNull();
  });

  it("durasi negatif dijepit ke nol", () => {
    expect(shiftDuration(-30)).toBe("0j 0m");
  });
});

describe("shiftClock", () => {
  it("memakai jam WIB, bukan jam server", () => {
    // 01:14 UTC = 08:14 WIB.
    expect(shiftClock("2026-10-24T01:14:00.000Z")).toBe("08:14");
  });

  it("ISO rusak dikembalikan apa adanya", () => {
    expect(shiftClock("bukan-tanggal")).toBe("bukan-tanggal");
  });
});

describe("shiftDateLabel", () => {
  it("membaca tanggal kalender tanpa bergeser sehari", () => {
    expect(shiftDateLabel("2026-10-24")).toBe("24 Okt 2026");
  });

  it("tanggal rusak dikembalikan apa adanya", () => {
    expect(shiftDateLabel("2026-10")).toBe("2026-10");
  });
});

describe("shiftBreakdown", () => {
  it("menyusun saldo awal + omzet, kas manual nol disembunyikan", () => {
    expect(shiftBreakdown(report()).map((row) => row.key)).toEqual([
      "opening",
      "services",
      "sales",
    ]);
  });

  it("kas masuk dan keluar muncul terpisah dengan tandanya", () => {
    const rows = shiftBreakdown(
      report({
        totals: {
          services: 400_000,
          sales: 350_000,
          manualIn: 200_000,
          manualOut: 5_000,
          manualNet: 195_000,
          expected: 1_445_000,
        },
      }),
    );
    expect(rows.slice(-2)).toEqual([
      { key: "manualIn", label: "Kas masuk", amount: 200_000, tone: "in" },
      { key: "manualOut", label: "Kas keluar", amount: 5_000, tone: "out" },
    ]);
  });
});
