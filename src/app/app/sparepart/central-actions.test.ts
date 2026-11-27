import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  approveStockRequest,
  createCentralItem,
  distributeCentralItemsBatch,
  distributeCentralStock,
  listCentralItems,
  listStockRequests,
  purchaseCentralStock,
  rejectStockRequest,
  requestStock,
} from "./central-actions";

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
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function asMaster() {
  mocks.getActiveTenant.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
    orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
  });
}

describe("central actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReset();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from },
      orgId: "org-1", branchId: "branch-1", role: "ADMIN",
    });
  });

  it("menolak admin cabang membuat item pusat", async () => {
    await expect(createCentralItem({ kind: "SPAREPART", sku: "A", name: "A", category: "Sparepart", stock_qty: 1, cost: 0, price: 0 }))
      .rejects.toThrow("Hanya Master Admin");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("meneruskan expectedStock saat distribusi", async () => {
    asMaster();
    await distributeCentralStock({ id: "item-1", targetBranchId: "branch-2", qty: 2, expectedStock: 9 });
    expect(mocks.rpc).toHaveBeenCalledWith("distribute_central_stock", expect.objectContaining({
      p_central_item_id: "item-1", p_qty: 2, p_expected_stock: 9,
    }));
  });

  it("cabang bisa request tapi tidak bisa approve", async () => {
    await requestStock({ sku: "A", qty: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("request_stock", expect.objectContaining({ p_qty: 2 }));
    await expect(approveStockRequest({ requestId: "r1", decidedQty: 2, centralItemId: "item-1", expectedStock: 9 }))
      .rejects.toThrow("Hanya Master Admin");
  });

  it("menolak admin membaca daftar item pusat sebelum query", async () => {
    const query = chain({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await expect(listCentralItems("")).rejects.toThrow("Hanya Master Admin");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("mencari item pusat dengan istilah yang disanitasi", async () => {
    asMaster();
    const query = chain({ data: [{ id: "item-1" }], error: null });
    mocks.from.mockReturnValue(query);

    const rows = await listCentralItems("Bat%,(x)");

    expect(mocks.from).toHaveBeenCalledWith("cervise_central_items");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.or).toHaveBeenCalledWith("name.ilike.%Batx%,sku.ilike.%Batx%,imei.ilike.%Batx%");
    expect(query.order).toHaveBeenCalledWith("name");
    expect(rows).toEqual([{ id: "item-1" }]);
  });

  it("meneruskan kind saat mencari item pusat", async () => {
    asMaster();
    const query = chain({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await listCentralItems("", "PRODUCT");

    expect(query.eq).toHaveBeenCalledWith("kind", "PRODUCT");
    expect(query.or).not.toHaveBeenCalled();
  });

  it("melempar error saat query item pusat gagal", async () => {
    asMaster();
    mocks.from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));

    await expect(listCentralItems("x")).rejects.toThrow("boom");
  });

  it("master admin melihat request seluruh organisasi", async () => {
    asMaster();
    const query = chain({ data: [{ id: "r1" }], error: null });
    mocks.from.mockReturnValue(query);

    const rows = await listStockRequests();

    expect(mocks.from).toHaveBeenCalledWith("cervise_stock_requests");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(query.eq).not.toHaveBeenCalledWith("branch_id", expect.anything());
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(rows).toEqual([{ id: "r1" }]);
  });

  it("non-master hanya melihat request cabangnya", async () => {
    const query = chain({ data: [], error: null });
    mocks.from.mockReturnValue(query);

    await listStockRequests();

    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-1");
    expect(query.eq).not.toHaveBeenCalledWith("organization_id", expect.anything());
  });

  it("melempar error saat query request gagal", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: "request boom" } }));

    await expect(listStockRequests()).rejects.toThrow("request boom");
  });

  it("meneruskan qty, modal, dan expectedStock saat pembelian pusat", async () => {
    asMaster();

    await purchaseCentralStock({ id: "item-1", qty: 3, unitCost: 1500, expectedStock: 9 });

    expect(mocks.rpc).toHaveBeenCalledWith("purchase_central_stock", expect.objectContaining({
      p_central_item_id: "item-1", p_qty: 3, p_unit_cost: 1500, p_expected_stock: 9,
    }));
  });

  it("menolak pembelian dengan qty nol sebelum RPC", async () => {
    asMaster();

    await expect(purchaseCentralStock({ id: "item-1", qty: 0, unitCost: 1500, expectedStock: 9 }))
      .rejects.toThrow("Jumlah pembelian harus lebih dari nol");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("menolak penolakan request tanpa alasan sebelum RPC", async () => {
    asMaster();

    await expect(rejectStockRequest({ requestId: "r1", reason: "  " }))
      .rejects.toThrow("Alasan penolakan minimal 3 karakter");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("meneruskan alasan yang dipangkas saat menolak request", async () => {
    asMaster();

    await rejectStockRequest({ requestId: "r1", reason: "  stok rusak  " });

    expect(mocks.rpc).toHaveBeenCalledWith("reject_stock_request", {
      p_request_id: "r1", p_reason: "stok rusak",
    });
  });

  it("master admin menyetujui request dengan jumlah dan stok yang diminta", async () => {
    asMaster();

    await approveStockRequest({ requestId: "r1", decidedQty: 2, centralItemId: "item-1", expectedStock: 9 });

    expect(mocks.rpc).toHaveBeenCalledWith("approve_stock_request", expect.objectContaining({
      p_request_id: "r1", p_decided_qty: 2, p_central_item_id: "item-1", p_expected_stock: 9,
    }));
  });

  it("master admin membuat item serialized dengan SKU dan IMEI yang dipangkas", async () => {
    asMaster();
    mocks.rpc.mockResolvedValue({ data: "item-created", error: null });

    const id = await createCentralItem({
      kind: "PRODUCT", sku: "  SKU-1  ", name: "  Unit A  ", category: "HP",
      stock_qty: 1, cost: 100, price: 200, imei: "  123456789012345  ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_central_item", expect.objectContaining({
      p_organization_id: "org-1", p_kind: "PRODUCT", p_sku: "SKU-1",
      p_stock_qty: 1, p_imei: "123456789012345", p_is_serialized: true,
    }));
    expect(id).toBe("item-created");
  });

  it("menolak batch kosong sebelum memanggil RPC", async () => {
    asMaster();
    await expect(distributeCentralItemsBatch({ targetBranchId: "branch-2", items: [] }))
      .rejects.toThrow("Pilih minimal satu item");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("meneruskan array item beserta expected_stock", async () => {
    asMaster();
    await distributeCentralItemsBatch({
      targetBranchId: "branch-2",
      items: [
        { id: "item-1", qty: 2, expectedStock: 9 },
        { id: "item-2", qty: 3, expectedStock: 5 },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("distribute_central_items_batch", {
      p_target_branch_id: "branch-2",
      p_items: [
        { central_item_id: "item-1", qty: 2, expected_stock: 9 },
        { central_item_id: "item-2", qty: 3, expected_stock: 5 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("meneruskan error RPC apa adanya", async () => {
    asMaster();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Baterai: stok berubah" } });
    await expect(distributeCentralItemsBatch({
      targetBranchId: "branch-2", items: [{ id: "item-1", qty: 1, expectedStock: 9 }],
    })).rejects.toThrow("Baterai: stok berubah");
  });
});
