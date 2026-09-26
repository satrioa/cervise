import { describe, expect, it } from "vitest";
import { buildLaporanKeuangan, type FinanceTx } from "./laporan-keuangan";

function tx(overrides: Partial<FinanceTx> = {}): FinanceTx {
  return {
    id: "tx-1",
    amount: 100_000,
    type: "pemasukan",
    kas_date: "2026-09-23",
    branch_id: "b1",
    description: "Servis",
    metode: "Tunai",
    ...overrides,
  };
}

describe("buildLaporanKeuangan", () => {
  it("returns honest zeroes for a period with no transactions", () => {
    const result = buildLaporanKeuangan({ transactions: [], branches: [], now: new Date(2026, 8, 23) });

    expect(result.totalMasuk).toBe(0);
    expect(result.totalKeluar).toBe(0);
    expect(result.totalNet).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(result.harian).toEqual([]);
    expect(result.bulanan).toEqual([]);
    expect(result.byBranch).toEqual([]);
    expect(result.byDescription).toEqual([]);
    expect(result.monthComparison.changePct).toBeNull();
  });

  it("separates income from spending", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", amount: 500_000 }),
        tx({ id: "b", type: "pengeluaran", amount: 200_000 }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.totalMasuk).toBe(500_000);
    expect(result.totalKeluar).toBe(200_000);
    expect(result.totalNet).toBe(300_000);
    expect(result.transactionCount).toBe(2);
  });

  it("ignores transactions with an unrecognised type instead of counting them as spending", () => {
    const result = buildLaporanKeuangan({
      transactions: [tx({ id: "a", type: "transfer_bank" })],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.totalMasuk).toBe(0);
    expect(result.totalKeluar).toBe(0);
  });

  it("groups transactions per day, oldest first", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", kas_date: "2026-09-23", amount: 100_000 }),
        tx({ id: "b", kas_date: "2026-09-21", amount: 50_000 }),
        tx({ id: "c", kas_date: "2026-09-23", amount: 25_000 }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.harian.map((row) => row.key)).toEqual(["2026-09-21", "2026-09-23"]);
    expect(result.harian[1]).toMatchObject({ masuk: 125_000, keluar: 0, net: 125_000, count: 2 });
  });

  it("groups transactions per month", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", kas_date: "2026-09-01" }),
        tx({ id: "b", kas_date: "2026-09-30" }),
        tx({ id: "c", kas_date: "2026-08-15" }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.bulanan.map((row) => row.key)).toEqual(["2026-08", "2026-09"]);
    expect(result.bulanan[1].count).toBe(2);
  });

  it("sums per branch and labels an unknown branch", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", branch_id: "b1", amount: 300_000 }),
        tx({ id: "b", branch_id: "b1", amount: 200_000 }),
        tx({ id: "c", branch_id: "b-ghost", amount: 50_000 }),
      ],
      branches: [
        { id: "b1", name: "Pusat" },
        { id: "b2", name: "Cabang 2" },
      ],
      now: new Date(2026, 8, 23),
    });

    expect(result.byBranch[0]).toMatchObject({ branchName: "Pusat", masuk: 500_000, count: 2 });
    expect(result.byBranch.map((row) => row.branchName)).toContain("—");
  });

  it("does not list a branch with no activity in the period", () => {
    const result = buildLaporanKeuangan({
      transactions: [tx({ branch_id: "b1" })],
      branches: [
        { id: "b1", name: "Pusat" },
        { id: "b2", name: "Cabang 2" },
      ],
      now: new Date(2026, 8, 23),
    });

    expect(result.byBranch).toHaveLength(1);
  });

  it("breaks income down by the description actually recorded", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", description: "Servis", amount: 300_000 }),
        tx({ id: "b", description: "Servis", amount: 100_000 }),
        tx({ id: "c", description: "Sparepart", amount: 100_000 }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.byDescription[0]).toMatchObject({ name: "Servis", amount: 400_000, pct: 80 });
    expect(result.byDescription[1]).toMatchObject({ name: "Sparepart", amount: 100_000, pct: 20 });
  });

  it("labels income with no description", () => {
    const result = buildLaporanKeuangan({
      transactions: [tx({ description: null })],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.byDescription[0].name).toBe("Tanpa keterangan");
  });

  it("leaves the breakdown empty when there is no income at all", () => {
    const result = buildLaporanKeuangan({
      transactions: [tx({ type: "pengeluaran", amount: 90_000 })],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.byDescription).toEqual([]);
  });

  it("compares this month against the previous one", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", kas_date: "2026-09-10", amount: 150_000 }),
        tx({ id: "b", kas_date: "2026-08-10", amount: 100_000 }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.monthComparison).toEqual({ current: 150_000, previous: 100_000, changePct: 50 });
  });

  it("refuses to invent a percentage when last month was empty", () => {
    const result = buildLaporanKeuangan({
      transactions: [tx({ kas_date: "2026-09-10", amount: 150_000 })],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.monthComparison.changePct).toBeNull();
  });

  it("reports a decline as a negative percentage", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "a", kas_date: "2026-09-10", amount: 50_000 }),
        tx({ id: "b", kas_date: "2026-08-10", amount: 100_000 }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.monthComparison.changePct).toBe(-50);
  });

  it("returns the newest transactions first for the activity feed", () => {
    const result = buildLaporanKeuangan({
      transactions: [
        tx({ id: "old", kas_date: "2026-09-01" }),
        tx({ id: "new", kas_date: "2026-09-20" }),
      ],
      branches: [],
      now: new Date(2026, 8, 23),
    });

    expect(result.recent.map((row) => row.id)).toEqual(["new", "old"]);
    expect(result.recent[0].branchName).toBe("—");
  });
});
