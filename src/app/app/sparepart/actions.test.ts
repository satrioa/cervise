import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSparepart,
  deleteSparepart,
  listSpareparts,
  purchaseSparepartStock,
  setSparepartActive,
  transferSparepartStock,
  updateSparepart,
} from "./actions";

const { mocks } = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  const getActiveTenant = vi.fn();
  return { mocks: { rpc, from, getActiveTenant } };
});
vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "maybeSingle", "single", "update", "delete", "insert"]) query[m] = vi.fn(() => query);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

describe("sparepart cabang mengikuti pusat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValue(chain({ data: null, error: null }));
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "ADMIN",
    });
  });

  it("admin cabang tidak bisa membuat sparepart baru", async () => {
    await expect(createSparepart({ name: "X", category: "Sparepart", stock_qty: 0, cost: 0, price: 0 }))
      .rejects.toThrow("Hanya Master Admin");
  });

  it("admin cabang tidak bisa mengubah harga", async () => {
    await expect(updateSparepart("s1", { name: "X", category: "Sparepart", stock_qty: 0, cost: 0, price: 999 }))
      .rejects.toThrow("Hanya Master Admin");
  });

  it("daftar sparepart cabang berasal dari katalog pusat", async () => {
    const master = { id: "c1", sku: "A", name: "A", category: "Sparepart", cost: 1, price: 2,
      stock_qty: 10, is_serialized: false, imei: null, parent_key: null, is_active: true };
    mocks.from.mockImplementation((table: string) => chain({
      data: table === "cervise_central_items" ? [master] : [{ central_item_id: "c1", stock_qty: 3 }],
      error: null,
    }));
    const rows = await listSpareparts("a");
    expect(mocks.from).toHaveBeenCalledWith("cervise_central_items");
    expect(rows[0]).toMatchObject({ id: "c1", stock_qty: 3 });
  });

  it("master admin membuat dan mengubah item lewat RPC pusat", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
    const input = { name: "X", category: "Sparepart", stock_qty: 2, cost: 1, price: 3 };
    await createSparepart(input);
    expect(mocks.rpc).toHaveBeenCalledWith("create_central_item", expect.objectContaining({
      p_organization_id: "org-1", p_kind: "SPAREPART", p_name: "X", p_price: 3, p_stock_qty: 2,
    }));

    await updateSparepart("c1", { ...input, price: 999 });
    expect(mocks.rpc).toHaveBeenCalledWith("update_central_item", expect.objectContaining({
      p_central_item_id: "c1", p_name: "X", p_price: 999,
    }));
  });

  it("pembelian stok langsung ke pusat tanpa baris cabang", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
    await purchaseSparepartStock({ id: "c1", qty: 2, unitCost: 5 });
    expect(mocks.rpc).toHaveBeenCalledWith("purchase_central_stock", expect.objectContaining({
      p_central_item_id: "c1", p_qty: 2, p_unit_cost: 5, p_expected_stock: null,
    }));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("transfer menolak item yang belum punya stok cabang", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
    await expect(transferSparepartStock({ id: "c1", targetBranchId: "branch-2", qty: 1 }))
      .rejects.toThrow("Stok cabang belum ada — distribusikan dari pusat dulu");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("status dan hapus menulis ke master, bukan baris cabang", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
    await setSparepartActive("c1", false);
    expect(mocks.rpc).toHaveBeenCalledWith("set_central_item_active", {
      p_central_item_id: "c1", p_is_active: false,
    });
    await deleteSparepart("c1");
    expect(mocks.rpc).toHaveBeenCalledWith("set_central_item_active", {
      p_central_item_id: "c1", p_is_active: false,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
