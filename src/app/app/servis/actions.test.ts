import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteServis, getServisDeleteImpact } from "./actions";

const mocks = vi.hoisted(() => {
  const state = {
    service: null as { id: string; device: string; kerusakan: string[] } | null,
    tag: null as { id: string; usage_count: number } | null,
    financeRows: [] as { amount: number }[],
    parts: [] as { id: string; name: string; qty: number }[],
  };

  const serviceSingle = { get data() { return state.service; }, error: null };
  const serviceSelect = vi.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle: async () => serviceSingle }) }),
  }));
  const serviceDelete = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));

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

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cervise_services":
        return { select: serviceSelect, delete: serviceDelete };
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

  return { state, from, serviceDelete, tagUpdate, getActiveTenant: vi.fn() };
});

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

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

  it("decrements tag usage counters so they do not drift", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.tag = { id: "tag-1", usage_count: 3 };

    await deleteServis("servis-1");

    expect(mocks.tagUpdate).toHaveBeenCalledWith({ usage_count: 2 });
  });

  it("never pushes a tag usage counter below zero", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.tag = { id: "tag-1", usage_count: 0 };

    await deleteServis("servis-1");

    expect(mocks.tagUpdate).toHaveBeenCalledWith({ usage_count: 0 });
  });

  it("skips tag updates when the tag row is already gone", async () => {
    mocks.getActiveTenant.mockResolvedValue(actorStub("ADMIN"));
    mocks.state.tag = null;

    await deleteServis("servis-1");

    expect(mocks.tagUpdate).not.toHaveBeenCalled();
    expect(mocks.serviceDelete).toHaveBeenCalled();
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
