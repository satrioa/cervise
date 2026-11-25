import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServis, deleteServis, getServisDeleteImpact, type CreateServisPayload } from "./actions";

const mocks = vi.hoisted(() => {
  const state = {
    service: null as { id: string; device: string; kerusakan: string[] } | null,
    priorService: null as { id: string } | null,
    createdId: "servis-new",
    insertError: null as { code?: string; message: string } | null,
    existingCustomer: null as { id: string } | null,
    tag: null as { id: string; usage_count: number } | null,
    financeRows: [] as { amount: number }[],
    parts: [] as { id: string; name: string; qty: number }[],
  };

  const serviceSelect = vi.fn(() => {
    const columns: string[] = [];
    const chain: any = {
      eq: (column: string) => {
        columns.push(column);
        return chain;
      },
      maybeSingle: async () => ({
        data: columns.includes("idempotency_key") ? state.priorService : state.service,
        error: null,
      }),
      single: async () => ({ data: state.service, error: null }),
    };
    return chain;
  });
  const serviceInsert = vi.fn(() => ({
    select: () => ({
      single: async () => {
        if (state.insertError) {
          // Race: dua pengiriman lolos cek awal, indeks unik menolak yang kedua.
          state.priorService = { id: "servis-race" };
          return { data: null, error: state.insertError };
        }
        return { data: { id: state.createdId }, error: null };
      },
    }),
  }));
  const serviceDelete = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));

  const customerSelect = vi.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.existingCustomer, error: null }) }) }),
  }));
  const customerInsert = vi.fn(() => ({
    select: () => ({ single: async () => ({ data: { id: "cust-new" }, error: null }) }),
  }));
  const customerUpdate = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const logInsert = vi.fn(async () => ({ error: null }));

  const tagSelect = vi.fn(() => ({
    eq: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: state.tag, error: null }) }) }),
  }));
  const tagUpdate = vi.fn(() => ({ eq: async () => ({ error: null }) }));

  const financeSelect = vi.fn(() => ({
    eq: () => ({ eq: () => ({ eq: async () => ({ data: state.financeRows, error: null }) }) }),
  }));

  const partsSelect = vi.fn(() => ({
    eq: () => ({ eq: async () => ({ data: state.parts, error: null }) }),
  }));

  // Counter tag sekarang lewat RPC, bukan baca-sulis di tabel.
  const rpc = vi.fn(async (name: string) => {
    if (name === "reserve_service_ticket") return { data: { allowed: true }, error: null };
    if (name === "next_service_number") return { data: "SRV-2026-0001", error: null };
    return { data: 0, error: null };
  });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cervise_services":
        return { select: serviceSelect, insert: serviceInsert, delete: serviceDelete };
      case "cervise_customers":
        return { select: customerSelect, insert: customerInsert, update: customerUpdate };
      case "cervise_service_logs":
        return { insert: logInsert };
      case "cervise_service_tags":
        return { select: tagSelect, update: tagUpdate };
      case "cervise_finance_tx":
        return { select: financeSelect };
      case "cervise_service_spareparts":
        return { select: partsSelect };
      default:
        throw new Error(`unexpected table: ${table}`);
    }
  });

  return { state, from, serviceDelete, serviceInsert, customerInsert, logInsert, tagUpdate, rpc, getActiveTenant: vi.fn() };
});

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function actorStub(role: string) {
  return {
    supabase: { from: mocks.from, rpc: mocks.rpc },
    userId: "user-1",
    orgId: "org-1",
    branchId: "branch-1",
    employeeId: "employee-1",
    role,
    subscription: null,
  };
}

describe("deleteServis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.service = { id: "servis-1", device: "iPhone 13", kerusakan: ["Layar retak"] };
    mocks.state.tag = null;
    mocks.state.financeRows = [];
    mocks.state.parts = [];
  });

  it("refuses to delete while spareparts are still consumed", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.parts = [{ id: "part-1", name: "Layar AMOLED", qty: 2 }];

    await expect(deleteServis("servis-1")).rejects.toThrow("Kembalikan ke stok");
    expect(mocks.serviceDelete).not.toHaveBeenCalled();
  });

  it("deletes once every sparepart has been returned", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.parts = [];

    await deleteServis("servis-1");

    expect(mocks.serviceDelete).toHaveBeenCalled();
  });

  it("rejects frontliner roles before touching the database", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("FRONTLINER"));

    await expect(deleteServis("servis-1")).rejects.toThrow("Hanya admin yang boleh menghapus servis");
    expect(mocks.serviceDelete).not.toHaveBeenCalled();
  });

  it("rejects teknisi roles", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("TEKNISI"));

    await expect(deleteServis("servis-1")).rejects.toThrow("Hanya admin yang boleh menghapus servis");
    expect(mocks.serviceDelete).not.toHaveBeenCalled();
  });

  it("deletes the service and reports what is destroyed", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));

    await expect(deleteServis("servis-1")).resolves.toEqual({
      id: "servis-1",
      device: "iPhone 13",
      orphanedPaymentCount: 0,
      orphanedPaymentTotal: 0,
    });
    expect(mocks.serviceDelete).toHaveBeenCalled();
  });

  it("reports payments that remain in finance as orphans", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("MASTER_ADMIN"));
    mocks.state.financeRows = [{ amount: 150000 }, { amount: 50000 }];

    const result = await deleteServis("servis-1");

    expect(result.orphanedPaymentCount).toBe(2);
    expect(result.orphanedPaymentTotal).toBe(200000);
  });

  it("menurunkan counter tag lewat rpc, bukan baca-sulis", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));

    await deleteServis("servis-1");

    expect(mocks.rpc).toHaveBeenCalledWith("bump_service_tag_usage", {
      p_branch_id: "branch-1",
      p_name: "Layar retak",
      p_delta: -1,
    });
  });

  it("memanggil rpc sekali per tag, tidak memedulikan apakah tag-nya sudah ada", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.service = { id: "servis-1", device: "iPhone 13", kerusakan: ["Layar retak", "Baterai drop"] };

    await deleteServis("servis-1");

    // RPC-nya `on conflict` + `greatest(..., 0)`, jadi baris yang belum ada
    // atau sudah nol tetap aman: tidak ada lagi cabang "tag tidak ditemukan"
    // yang harus dilewati di sini.
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("still deletes when the service has no recorded tags", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.service = { id: "servis-1", device: "iPhone 13", kerusakan: [] };

    await expect(deleteServis("servis-1")).resolves.toMatchObject({ id: "servis-1" });
    expect(mocks.serviceDelete).toHaveBeenCalled();
  });
});

describe("getServisDeleteImpact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.service = { id: "servis-1", device: "iPhone 13", kerusakan: ["Layar retak", "Baterai drop"] };
    mocks.state.financeRows = [];
  });

  it("summarises payments and tags for the confirmation dialog", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.financeRows = [{ amount: 75000 }];

    await expect(getServisDeleteImpact("servis-1")).resolves.toEqual({
      paymentCount: 1,
      paymentTotal: 75000,
      tagCount: 2,
    });
  });

  it("is admin-only", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("FRONTLINER"));

    await expect(getServisDeleteImpact("servis-1")).rejects.toThrow("Hanya admin yang boleh menghapus servis");
  });
});

describe("createServis idempotency", () => {
  const payload = (overrides: Partial<CreateServisPayload> = {}): CreateServisPayload => ({
    idempotencyKey: "key-1",
    teknisi_id: "p1",
    merk: "Apple",
    tipe: "iPhone 12",
    kerusakan: ["Layar pecah"],
    kelengkapan: [],
    password_type: "PIN",
    password_value: "1234",
    customer_name: "Raka",
    customer_phone: "08123456789",
    garansi_value: 30,
    garansi_unit: "hari",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.service = null;
    mocks.state.priorService = null;
    mocks.state.insertError = null;
    mocks.state.existingCustomer = { id: "cust-1" };
  });

  it("mengembalikan tiket lama tanpa efek samping saat kunci sama", async () => {
    mocks.state.priorService = { id: "servis-lama" };

    await expect(createServis(payload())).resolves.toEqual({ id: "servis-lama" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
    expect(mocks.logInsert).not.toHaveBeenCalled();
  });

  it("menyimpan kunci di baris baru", async () => {
    await expect(createServis(payload())).resolves.toEqual({ id: "servis-new" });
    expect(mocks.serviceInsert).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: "key-1" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_service_ticket", { p_organization_id: "org-1" });
  });

  it("mengembalikan tiket yang menang race saat indeks unik menolak duplikat", async () => {
    mocks.state.insertError = { code: "23505", message: "duplicate key" };

    await expect(createServis(payload())).resolves.toEqual({ id: "servis-race" });
    expect(mocks.logInsert).not.toHaveBeenCalled();
  });

  it("tetap membuat tiket baru bila tanpa kunci", async () => {
    await createServis(payload({ idempotencyKey: undefined }));

    expect(mocks.serviceInsert).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: null }),
    );
    expect(mocks.logInsert).toHaveBeenCalled();
  });
});
