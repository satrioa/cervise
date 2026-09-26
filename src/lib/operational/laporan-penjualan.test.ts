import { describe, expect, it } from "vitest";
import { buildLaporanPenjualan, paymentStatusLabel, type SaleInput } from "./laporan-penjualan";

const NOW = new Date(2026, 8, 23, 15, 30, 0);

function sale(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    sale_number: "INV-20260923-001",
    kas_date: "2026-09-23",
    subtotal: 100_000,
    discount_total: 0,
    total: 100_000,
    paid: 100_000,
    payment_status: "lunas",
    payment_method: "Tunai",
    branch_id: "b1",
    ...overrides,
  };
}

const branches = [{ id: "b1", name: "Pusat" }];

describe("paymentStatusLabel", () => {
  it("labels the statuses the database actually stores", () => {
    expect(paymentStatusLabel("lunas")).toBe("Lunas");
    expect(paymentStatusLabel("belum_bayar")).toBe("Belum bayar");
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(paymentStatusLabel("cicilan")).toBe("cicilan");
  });
});

describe("buildLaporanPenjualan", () => {
  it("returns honest zeroes when there are no sales", () => {
    const result = buildLaporanPenjualan({ sales: [], branches, now: NOW });

    expect(result.harian).toEqual([]);
    expect(result.bulanan).toEqual([]);
    expect(result.sales).toEqual([]);
    expect(result.summary).toEqual({ omzet: 0, paid: 0, unpaid: 0, discount: 0, count: 0 });
  });

  it("sums total as omzet", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ total: 350_000, paid: 350_000 }), sale({ total: 120_000, paid: 120_000 })],
      branches,
      now: NOW,
    });

    expect(result.summary.omzet).toBe(470_000);
    expect(result.summary.count).toBe(2);
  });

  it("surfaces the outstanding balance instead of hiding it", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ total: 800_000, paid: 400_000, payment_status: "belum_bayar" })],
      branches,
      now: NOW,
    });

    expect(result.summary.paid).toBe(400_000);
    expect(result.summary.unpaid).toBe(400_000);
  });

  it("never reports a negative balance when paid exceeds total", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ total: 100_000, paid: 120_000 })],
      branches,
      now: NOW,
    });

    expect(result.summary.unpaid).toBe(0);
  });

  it("sums recorded discounts", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ total: 90_000, discount_total: 10_000, paid: 90_000 })],
      branches,
      now: NOW,
    });

    expect(result.summary.discount).toBe(10_000);
  });

  it("treats a null paid as nothing received", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ total: 500_000, paid: null })],
      branches,
      now: NOW,
    });

    expect(result.summary.paid).toBe(0);
    expect(result.summary.unpaid).toBe(500_000);
  });

  it("groups sales per day, newest first", () => {
    const result = buildLaporanPenjualan({
      sales: [
        sale({ id: "a", kas_date: "2026-09-23" }),
        sale({ id: "b", kas_date: "2026-09-22" }),
        sale({ id: "c", kas_date: "2026-09-23" }),
      ],
      branches,
      now: NOW,
    });

    expect(result.harian.map((row) => row.key)).toEqual(["2026-09-23", "2026-09-22"]);
    expect(result.harian[0].count).toBe(2);
    expect(result.harian[0].omzet).toBe(200_000);
  });

  it("groups sales per month", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ kas_date: "2026-09-01" }), sale({ kas_date: "2026-08-15" })],
      branches,
      now: NOW,
    });

    expect(result.bulanan.map((row) => row.key)).toEqual(["2026-09", "2026-08"]);
  });

  it("labels each detail row with its nota number, method and branch", () => {
    const result = buildLaporanPenjualan({ sales: [sale()], branches, now: NOW });

    expect(result.sales[0]).toMatchObject({
      label: "INV-20260923-001",
      paymentMethod: "Tunai",
      branchName: "Pusat",
    });
  });

  it("falls back to a short id when a sale has no number", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ sale_number: null, id: "abcdef12-3456" })],
      branches,
      now: NOW,
    });

    expect(result.sales[0].label).toBe("ABCDEF12");
  });

  it("labels an unknown branch and a missing payment method", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ branch_id: "ghost", payment_method: null })],
      branches,
      now: NOW,
    });

    expect(result.sales[0]).toMatchObject({ branchName: "—", paymentMethod: "—" });
  });

  it("keeps the detail rows attached to their day for the print view", () => {
    const result = buildLaporanPenjualan({
      sales: [sale({ id: "a", kas_date: "2026-09-23" }), sale({ id: "b", kas_date: "2026-09-22" })],
      branches,
      now: NOW,
    });

    expect(result.harian[0].sales.map((s) => s.id)).toEqual(["a"]);
    expect(result.harian[1].sales.map((s) => s.id)).toEqual(["b"]);
  });

  it("does not mutate the input", () => {
    const input = [sale()];
    const before = JSON.stringify(input);
    buildLaporanPenjualan({ sales: input, branches, now: NOW });
    expect(JSON.stringify(input)).toBe(before);
  });
});
