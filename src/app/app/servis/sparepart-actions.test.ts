import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSparepartsToServis,
  cancelServisWithSpareparts,
  confirmServisPickup,
  getServisSpareparts,
  searchSparepartStock,
  updateServisStatus,
  useSparepartsForServis,
} from "./sparepart-actions";

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
  query.ilike = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const sparepartRow = {
  id: "sparepart-1",
  sku: "BAT-001",
  name: "Baterai iPhone 12",
  category: "Baterai",
  stock_qty: 4,
  cost: 90000,
  price: 150000,
  is_active: true,
};

describe("servis sparepart actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValue(chain({ data: [], error: null }));
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { from: mocks.from, rpc: mocks.rpc },
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "TECHNICIAN",
      subscription: null,
    });
  });

  it("searches the branch sparepart table in rupiah", async () => {
    mocks.from.mockReturnValue(chain({ data: [sparepartRow], error: null }));

    const rows = await searchSparepartStock("baterai");

    expect(mocks.from).toHaveBeenCalledWith("cervise_spareparts");
    expect(rows[0]).toMatchObject({ id: "sparepart-1", sku: "BAT-001", qty: 4, price: 150000, cost: 90000 });
  });

  it("propagates sparepart query errors instead of returning empty rows", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));

    await expect(searchSparepartStock("x")).rejects.toThrow("boom");
  });

  it("reads sparepart lines with their returned state", async () => {
    const selectChain = chain({
      data: [
        {
          id: "line-1",
          product_id: null,
          sparepart_id: "sparepart-1",
          sku: "BAT-001",
          name: "Baterai iPhone 12",
          category: "Baterai",
          qty: 2,
          unit_price: 150000,
          cost: 90000,
          line_total: 300000,
          is_returned: false,
          returned_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(selectChain);

    const rows = await getServisSpareparts("servis-1");

    expect(mocks.from).toHaveBeenCalledWith("cervise_service_spareparts");
    expect(rows[0]).toMatchObject({ sparepart_id: "sparepart-1", qty: 2, unit_price: 150000, is_returned: false });
  });

  it("consumes spareparts and flips the stage through one rpc", async () => {
    await useSparepartsForServis("servis-1", [{ sparepart_id: "sparepart-1", qty: 2 }]);

    expect(mocks.rpc).toHaveBeenCalledWith("consume_service_spareparts", {
      p_servis_id: "servis-1",
      p_items: [{ sparepart_id: "sparepart-1", qty: 2 }],
      p_set_status: true,
    });
  });

  it("adds spareparts without touching the stage", async () => {
    await addSparepartsToServis("servis-1", [{ sparepart_id: "sparepart-1", qty: 1 }]);

    expect(mocks.rpc).toHaveBeenCalledWith("consume_service_spareparts", {
      p_servis_id: "servis-1",
      p_items: [{ sparepart_id: "sparepart-1", qty: 1 }],
      p_set_status: false,
    });
  });

  it("rejects an empty selection before calling the database", async () => {
    await expect(addSparepartsToServis("servis-1", [])).rejects.toThrow("Pilih minimal 1 sparepart");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a reason when cancelling with spareparts", async () => {
    await expect(cancelServisWithSpareparts("servis-1", "return", "  ")).rejects.toThrow("Alasan wajib diisi");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns stock then cancels the service", async () => {
    await cancelServisWithSpareparts("servis-1", "return", "Pelanggan batal repair");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "return_service_spareparts", {
      p_servis_id: "servis-1",
      p_reason: "Pelanggan batal repair",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "set_service_status", {
      p_servis_id: "servis-1",
      p_status: "Batal",
      p_note: "Pelanggan batal repair",
    });
  });

  it("keeps consumed parts but still cancels the service", async () => {
    await cancelServisWithSpareparts("servis-1", "keep_consumed", "Sparepart sudah terpasang");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "mark_service_spareparts_kept", {
      p_servis_id: "servis-1",
      p_reason: "Sparepart sudah terpasang",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "set_service_status", {
      p_servis_id: "servis-1",
      p_status: "Batal",
      p_note: "Sparepart sudah terpasang",
    });
  });

  it("writes the stage through the status rpc using the ui label", async () => {
    await updateServisStatus("servis-1", "Dikerjakan");

    expect(mocks.rpc).toHaveBeenCalledWith("set_service_status", {
      p_servis_id: "servis-1",
      p_status: "Dikerjakan",
      p_note: null,
    });
  });

  it("surfaces database errors to the caller", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "stok tidak cukup" } });

    await expect(updateServisStatus("servis-1", "Dikerjakan")).rejects.toThrow("stok tidak cukup");
  });

  it("requires a signature before confirming pickup", async () => {
    await expect(confirmServisPickup("servis-1", "")).rejects.toThrow("Tanda tangan wajib");
    await expect(confirmServisPickup("servis-1", "   ")).rejects.toThrow("Tanda tangan wajib");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an svg payload before confirming pickup", async () => {
    await expect(confirmServisPickup("servis-1", "tulisan-ku")).rejects.toThrow("Tanda tangan wajib");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("confirms pickup through the signature rpc with the trimmed svg", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0 L100 50" /></svg>';
    await confirmServisPickup("servis-1", `  ${svg}  `);

    expect(mocks.rpc).toHaveBeenCalledWith("set_service_picked_up", {
      p_servis_id: "servis-1",
      p_signature: svg,
      p_note: null,
    });
  });

  it("passes an optional note through to the pickup rpc", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0 L100 50" /></svg>';

    await confirmServisPickup("servis-1", svg, "Customer tidak ada");

    expect(mocks.rpc).toHaveBeenCalledWith("set_service_picked_up", {
      p_servis_id: "servis-1",
      p_signature: svg,
      p_note: "Customer tidak ada",
    });
  });

  it("menolak pengambilan kalau servis belum lunas", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "cervise_services") return chain({ data: { price: 0, price_estimasi: 500_000 }, error: null });
      return chain({ data: [{ amount: 200_000 }], error: null });
    });

    await expect(confirmServisPickup("servis-1", '<svg viewBox="0 0 1 1"></svg>')).rejects.toThrow(
      "belum lunas",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("mengizinkan pengambilan setelah pembayaran menutup tagihan", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "cervise_services") return chain({ data: { price: 500_000, price_estimasi: 500_000 }, error: null });
      return chain({ data: [{ amount: 500_000 }], error: null });
    });

    await confirmServisPickup("servis-1", '<svg viewBox="0 0 1 1"></svg>');

    expect(mocks.rpc).toHaveBeenCalledWith("set_service_picked_up", expect.objectContaining({ p_servis_id: "servis-1" }));
  });
});
