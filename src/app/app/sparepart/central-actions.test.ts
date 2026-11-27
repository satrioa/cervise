import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveStockRequest,
  createCentralItem,
  distributeCentralStock,
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

describe("central actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from },
      orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
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
});
