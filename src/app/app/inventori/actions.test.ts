import { beforeEach, describe, expect, it, vi } from "vitest";
import { importInventori } from "./actions";

const { mocks } = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  const getActiveTenant = vi.fn();
  const prepare = vi.fn();
  return { mocks: { rpc, from, getActiveTenant, prepare } };
});
vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("@/lib/inventori/import", () => ({ prepareInventoriImport: mocks.prepare }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "maybeSingle", "single", "update", "delete", "insert"]) query[m] = vi.fn(() => query);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const product = {
  name: "iPhone 14",
  sku: "IP-14",
  category: "Gadget",
  variant_type: "BARU",
  storage: "256 GB",
  warna: "Blue",
  stock_qty: 2,
  cost: 100,
  price: 200,
  barcode: "BC-1",
  imei: null,
  bh_percent: null,
  garansi_days: 30,
  kondisi_notes: "catatan",
  parent_key: "iphone-14",
};

describe("importInventori menulis ke katalog pusat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: "c1", error: null });
    mocks.from.mockReturnValue(chain({ data: [], error: null }));
    mocks.prepare.mockReturnValue({ products: [product], errors: [] });
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
  });

  it("menolak non master admin sebelum query maupun rpc", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "ADMIN",
    });
    await expect(importInventori([{ nama: "X" }])).rejects.toThrow("Hanya Master Admin boleh impor produk");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("mencek sku duplikat di katalog pusat tenant", async () => {
    const query = chain({ data: [], error: null });
    mocks.from.mockReturnValue(query);
    await importInventori([{ nama: "X" }]);
    expect(mocks.from).toHaveBeenCalledWith("cervise_central_items");
    expect(mocks.from).not.toHaveBeenCalledWith("cervise_products");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("mengirim semua atribut varian ke create_central_item", async () => {
    await importInventori([{ nama: "X" }]);
    expect(mocks.rpc).toHaveBeenCalledWith("create_central_item", {
      p_organization_id: "org-1",
      p_kind: "PRODUCT",
      p_sku: "IP-14",
      p_name: "iPhone 14",
      p_category: "Gadget",
      p_cost: 100,
      p_price: 200,
      p_stock_qty: 2,
      p_is_serialized: false,
      p_imei: null,
      p_parent_key: "iphone-14",
      p_barcode: "BC-1",
      p_variant_type: "BARU",
      p_storage: "256 GB",
      p_warna: "Blue",
      p_bh_percent: null,
      p_kondisi_notes: "catatan",
      p_garansi_days: 30,
    });
  });
});
