import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordServisPayment } from "./cash";

const mocks = vi.hoisted(() => {
  const state = {
    service: null as {
      id: string;
      price: number;
      price_estimasi: number | null;
      status: string;
      customer_id: string | null;
      branch_id: string;
      service_number: string | null;
    } | null,
    paidRows: [] as { amount: number }[],
    insertErrors: {} as Record<string, string>,
    calls: [] as Array<{ table: string; op: string; payload?: unknown }>,
  };

  const done = { error: null as { message: string } | null };

  const serviceSelect = vi.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.service, error: null }) }) }),
  }));
  const serviceUpdate = vi.fn((payload: unknown) => {
    state.calls.push({ table: "cervise_services", op: "update", payload });
    return { eq: () => ({ eq: async () => ({ error: null }) }) };
  });
  const paidSelect = vi.fn(() => ({
    eq: () => ({ eq: () => ({ eq: async () => ({ data: state.paidRows, error: null }) }) }),
  }));
  const saleInsert = vi.fn((payload: unknown) => {
    state.calls.push({ table: "cervise_sales", op: "insert", payload });
    return {
      select: () => ({
        single: async () =>
          state.insertErrors.cervise_sales
            ? { data: null, error: { message: state.insertErrors.cervise_sales } }
            : { data: { id: "sale-1", sale_number: "SAL-TEST" }, error: null },
      }),
    };
  });
  const financeInsert = vi.fn((payload: unknown) => {
    state.calls.push({ table: "finance_tx", op: "insert", payload });
    return {
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          error: state.insertErrors.finance_tx ? { message: state.insertErrors.finance_tx } : null,
        }),
    };
  });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cervise_services":
        return { select: serviceSelect, update: serviceUpdate };
      case "finance_tx":
        return { select: paidSelect, insert: financeInsert };
      case "cervise_sales":
        return { insert: saleInsert };
      default:
        throw new Error(`unexpected table: ${table}`);
    }
  });

  return { state, from, getActiveTenant: vi.fn(), done };
});

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));

function actorStub(role: string) {
  return {
    supabase: { from: mocks.from },
    userId: "user-1",
    orgId: "org-1",
    branchId: "branch-1",
    employeeId: "employee-1",
    role,
    subscription: null,
  };
}

function serviceRow(overrides: Partial<NonNullable<typeof mocks.state.service>> = {}) {
  return {
    id: "s1",
    price: 0,
    price_estimasi: null,
    status: "Selesai",
    customer_id: "c1",
    branch_id: "branch-1",
    service_number: "SRV-1",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.state.service = serviceRow();
  mocks.state.paidRows = [];
  mocks.state.insertErrors = {};
  mocks.state.calls = [];
  mocks.getActiveTenant.mockReset();
  mocks.getActiveTenant.mockResolvedValue(actorStub("FRONTLINER"));
});

describe("recordServisPayment", () => {
  it("menulis cervise_sales dan finance_tx supaya dua laporan sama-sama melihat", async () => {
    mocks.state.service = serviceRow({ price_estimasi: 150000 });

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai" });

    expect(result.ok).toBe(true);
    const tables = mocks.state.calls.map((call) => call.table);
    expect(tables).toContain("cervise_sales");
    expect(tables).toContain("finance_tx");

    const sale = mocks.state.calls.find((call) => call.table === "cervise_sales")?.payload as Record<string, unknown>;
    expect(sale.servis_id).toBe("s1");
    expect(sale.total).toBe(150000);

    const finance = mocks.state.calls.find((call) => call.table === "finance_tx")?.payload as Record<string, unknown>;
    expect(finance.servis_id).toBe("s1");
    expect(finance.amount).toBe(150000);
    expect(finance.metode).toBe("Tunai");
  });

  it("menolak pembayaran lagi kalau sudah lunas, tanpa menulis apa pun", async () => {
    mocks.state.service = serviceRow({ price: 150000, price_estimasi: 150000 });
    mocks.state.paidRows = [{ amount: 150000 }];

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai" });

    expect(result).toEqual({ ok: false, error: "Servis ini sudah lunas" });
    expect(mocks.state.calls).toHaveLength(0);
  });

  it("mener pembayaran DP di atas pembayaran yang sudah ada", async () => {
    mocks.state.service = serviceRow({ price: 100000, price_estimasi: 150000 });
    mocks.state.paidRows = [{ amount: 100000 }];

    const result = await recordServisPayment({ servisId: "s1", metode: "QRIS", amount: 50000 });

    expect(result.ok).toBe(true);
    const finance = mocks.state.calls.find((call) => call.table === "finance_tx")?.payload as Record<string, unknown>;
    expect(finance.amount).toBe(50000);
  });

  it("menerima nominal eksplisit untuk servis tanpa harga estimasi", async () => {
    mocks.state.service = serviceRow();

    const result = await recordServisPayment({ servisId: "s1", metode: "E-Wallet", amount: 75000 });

    expect(result.ok).toBe(true);
  });

  it("menolak nominal nol atau negatif", async () => {
    mocks.state.service = serviceRow();

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai", amount: 0 });

    expect(result).toEqual({ ok: false, error: "Nominal pembayaran tidak valid" });
    expect(mocks.state.calls).toHaveLength(0);
  });

  it("menolak servis yang dibatalkan", async () => {
    mocks.state.service = serviceRow({ status: "Batal" });

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai", amount: 1000 });

    expect(result).toEqual({ ok: false, error: "Servis dibatalkan tidak bisa dibayar" });
    expect(mocks.state.calls).toHaveLength(0);
  });

  it("menolak metode pembayaran yang tidak dikenal", async () => {
    const result = await recordServisPayment({
      servisId: "s1",
      metode: "Kartu Kredit" as never,
      amount: 1000,
    });

    expect(result).toEqual({ ok: false, error: "Metode pembayaran tidak valid" });
  });

  it("menolak role yang tidak boleh menjual", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("TECHNICIAN"));

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai", amount: 1000 });

    expect(result).toEqual({ ok: false, error: "Role tidak diizinkan melakukan pembayaran" });
    expect(mocks.state.calls).toHaveLength(0);
  });

  it("menycitepakai tanggal toko, bukan tanggal UTC", async () => {
    mocks.state.service = serviceRow({ price_estimasi: 50000 });

    await recordServisPayment({ servisId: "s1", metode: "Tunai" });

    const sale = mocks.state.calls.find((call) => call.table === "cervise_sales")?.payload as Record<string, unknown>;
    const finance = mocks.state.calls.find((call) => call.table === "finance_tx")?.payload as Record<string, unknown>;
    expect(sale.kas_date).toBe(finance.kas_date);
    expect(String(sale.kas_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("menerjemahkan kegagalan finance_tx menjadi error yang terbaca", async () => {
    mocks.state.service = serviceRow({ price_estimasi: 50000 });
    mocks.state.insertErrors.finance_tx = "stok berubah oleh transaksi lain";

    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("stok berubah");
  });
});