import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFrontlinerQueue, recordServisPayment } from "./cash";

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
    /** Baris `finance_tx` income per servis, untuk antrean kasir. */
    paidFinanceRows: [] as { servis_id: string; amount: number }[],
    /** `servis_id` yang sudah punya baris di `cervise_sales`. */
    paidSaleIds: [] as string[],
    queueServices: [] as {
      id: string;
      service_number: string | null;
      device: string;
      status: string;
      price: number;
      price_estimasi: number | null;
      created_at: string;
      customer_id: string | null;
    }[],
    customerRows: [] as { id: string; name: string }[],
    insertErrors: {} as Record<string, string>,
    calls: [] as Array<{ table: string; op: string; payload?: unknown }>,
  };

  const done = { error: null as { message: string } | null };

  /**
   * `cervise_services` dipakai dua bentuk rantai:
   * - pembayaran servis: `.eq().eq().maybeSingle()`
   * - antrean kasir:     `.eq().not().order().limit()`
   * Satu mock melayani keduanya, jadi objek hasil `.eq()` kedua membuka
   * `maybeSingle` dan `not` sekaligus.
   */
  const serviceSelect = vi.fn(() => {
    // `cervise_services` punya dua bentuk rantai:
    // - pembayaran servis: `.eq(id).eq(branch_id).maybeSingle()`
    // - antrean kasir:     `.eq(branch_id).not(status).order().limit()`
    // Satu mock melayani keduanya, jadi objek hasil `.eq()` pertama membuka
    // `maybeSingle` (lewat `.eq()` kedua) dan `not` sekaligus.
    const order = () => ({
      limit: async () => ({ data: state.queueServices, error: null }),
    });
    return {
      eq: () => ({
        maybeSingle: async () => ({ data: state.service, error: null }),
        eq: () => ({
          maybeSingle: async () => ({ data: state.service, error: null }),
          not: () => ({ order }),
        }),
        not: () => ({ order }),
      }),
    };
  });
  const serviceUpdate = vi.fn((payload: unknown) => {
    state.calls.push({ table: "cervise_services", op: "update", payload });
    return { eq: () => ({ eq: async () => ({ error: null }) }) };
  });
  const paidSelect = vi.fn(() => {
    // `finance_tx` punya dua bentuk rantai:
    // - pembayaran:   `.eq(branch).eq(servis).eq(type)` lalu di-await
    // - antrean kasir: `.eq(branch).eq(type).not(servis_id)` lalu di-await
    // Keduanya mulai dari `.eq()`, jadi `eq` membuka `eq` dan `not` sekaligus
    // dan mengembalikan dirinya sendiri untukallows lebih dari tiga filter.
    const stage = {
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: state.paidRows, error: null }),
      not: () => ({
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: state.paidFinanceRows, error: null }),
      }),
    };
    const chain: Record<string, unknown> = {
      ...stage,
      eq: () => chain,
    };
    return { eq: () => chain };
  });
  const paidSalesSelect = vi.fn(() => ({
    eq: () => ({
      not: () => ({
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: state.paidSaleIds.map((servis_id) => ({ servis_id })),
            error: null,
          }),
      }),
    }),
  }));
  const customerSelect = vi.fn(() => ({
    in: async () => ({ data: state.customerRows, error: null }),
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
        return { insert: saleInsert, select: paidSalesSelect };
      case "cervise_customers":
        return { select: customerSelect };
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
  mocks.state.paidFinanceRows = [];
  mocks.state.paidSaleIds = [];
  mocks.state.queueServices = [];
  mocks.state.customerRows = [];
  mocks.state.insertErrors = {};
  mocks.state.calls = [];
  mocks.getActiveTenant.mockReset();
  mocks.getActiveTenant.mockResolvedValue(actorStub("FRONTLINER"));
});

describe("getFrontlinerQueue", () => {
  function queueRow(overrides: Partial<NonNullable<typeof mocks.state.queueServices>[number]>) {
    return {
      id: "s2",
      service_number: "SRV-2",
      device: "Redmi Note 13",
      status: "Selesai",
      price: 50000,
      price_estimasi: 150000,
      created_at: "2026-10-18T02:00:00Z",
      customer_id: "c1",
      ...overrides,
    };
  }

  it("tidak menampilkan servis yang pembayarannya ada di finance_tx saja", async () => {
    // Regresi yang ditemukan audit: baris lama dari addPembayaran tidak pernah
    // punya baris cervise_sales, jadi servis yang sudah lunas tetap muncul di
    // antrean dan bisa dibayar dua kali.
    mocks.state.queueServices = [queueRow({ id: "s1" })];
    mocks.state.paidFinanceRows = [{ servis_id: "s1", amount: 150000 }];
    mocks.state.paidSaleIds = [];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual([]);
  });

  it("tidak menampilkan servis yang pembayarannya ada di cervise_sales", async () => {
    mocks.state.queueServices = [queueRow({ id: "s1" })];
    mocks.state.paidSaleIds = ["s1"];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual([]);
  });

  it("tetap menampilkan servis yang belum dibayar", async () => {
    mocks.state.queueServices = [queueRow({})];
    mocks.state.customerRows = [{ id: "c1", name: "Budi" }];

    const result = await getFrontlinerQueue();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((item) => item.id)).toEqual(["s2"]);
    expect(result.data[0].customerName).toBe("Budi");
  });

  it("menyertakan estimasi supaya kasir bisa mengisi sisa tagihan", async () => {
    mocks.state.queueServices = [queueRow({})];

    const result = await getFrontlinerQueue();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].priceEstimasi).toBe(150000);
  });

  it("menjumlahkan beberapa pembayaran sebelum menilai lunas", async () => {
    // 50rb + 25rb = 75rb dari estimasi 150rb: belum lunas, jadi masih di antrean.
    mocks.state.queueServices = [queueRow({})];
    mocks.state.paidFinanceRows = [
      { servis_id: "s2", amount: 50000 },
      { servis_id: "s2", amount: 25000 },
    ];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual(["s2"]);
  });

  it("menyembunyikan servis yang pembayarannya sudah mencapai estimasi", async () => {
    mocks.state.queueServices = [queueRow({})];
    mocks.state.paidFinanceRows = [
      { servis_id: "s2", amount: 50000 },
      { servis_id: "s2", amount: 100000 },
    ];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual([]);
  });

  it("menyembunyikan servis yang pembayarannya melebihi estimasi", async () => {
    mocks.state.queueServices = [queueRow({})];
    mocks.state.paidFinanceRows = [{ servis_id: "s2", amount: 175000 }];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual([]);
  });

  it("servis tanpa estimasi tetap tampil walau sudah ada pembayaran", async () => {
    // Tanpa estimasi tidak ada cara memastikan lunas, jadi kasir yang menilai.
    mocks.state.queueServices = [queueRow({ price_estimasi: null })];
    mocks.state.paidFinanceRows = [{ servis_id: "s2", amount: 50000 }];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual(["s2"]);
    expect(result.ok && result.data[0].priceEstimasi).toBeNull();
  });

  it("seorang servis yang sudah lunas tidak muncul walau pembayarannya di kedua tabel", async () => {
    mocks.state.queueServices = [queueRow({ id: "s1" }), queueRow({ id: "s2" })];
    mocks.state.paidSaleIds = ["s1"];
    mocks.state.paidFinanceRows = [{ servis_id: "s1", amount: 150000 }];

    const result = await getFrontlinerQueue();

    expect(result.ok && result.data.map((item) => item.id)).toEqual(["s2"]);
  });
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