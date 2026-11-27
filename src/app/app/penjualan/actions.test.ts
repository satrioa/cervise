import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutSale, createProduct, createSale } from "./actions";

const {
  from,
  productQuery,
  productUpdate,
  rpc,
  salesItemInsert,
  salesInsert,
  getActiveTenant,
  handoverState,
} = vi.hoisted(() => {
  const productQuery = { data: [] as any[], error: null as any };
  const customerSingle = { data: { id: "customer-1", tags: [] } as any, error: null as any };
  const salesSingle = { data: { id: "sale-1" } as any, error: null as any };
  const handoverState = { openSessionId: "session-1" as string | null, pendingHandover: false };

  const productUpdate = vi.fn(() => {
    const chain: any = { eq: () => chain, select: async () => ({ data: [], error: null }) };
    return chain;
  });
  const customerUpdate = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const salesItemInsert = vi.fn(async () => ({ error: null }));
  const salesInsert = vi.fn((): any => ({ select: () => ({ single: async () => salesSingle }) }));
  const financeInsert = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
    if (name === "create_sale_with_stock") {
      return { data: { id: "sale-1", sale_number: "SLV-2026-0003", total: 200 }, error: null };
    }
    if (name === "create_central_item") return { data: "central-1", error: null };
    return { data: "SLV-2026-0003", error: null };
  });

  const cashSessionChain = () => {
    const q: any = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({
        data: handoverState.openSessionId ? { id: handoverState.openSessionId } : null,
        error: null,
      }),
    };
    return q;
  };
  const handoverChain = () => {
    const q: any = {
      select: () => q,
      eq: () => q,
      is: () => q,
      limit: () => q,
      maybeSingle: async () => ({
        data: handoverState.pendingHandover ? { id: "handover-1" } : null,
        error: null,
      }),
    };
    return q;
  };

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cervise_products":
        return {
          update: productUpdate,
          select: () => ({ in: () => ({ eq: async () => productQuery }) }),
        };
      case "cervise_customers":
        return {
          update: customerUpdate,
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => customerSingle }) }) }),
        };
      case "cervise_sales":
        return { insert: salesInsert };
      case "cervise_sales_items":
        return {
          insert: salesItemInsert,
          select: () => ({ eq: () => ({ contains: async () => ({ data: [] }) }) }),
        };
      case "finance_tx":
      case "cervise_finance_tx":
        return { insert: financeInsert };
      case "cervise_cash_sessions":
        return cashSessionChain();
      case "cervise_cash_session_handovers":
        return handoverChain();
      default:
        throw new Error(`unexpected table: ${table}`);
    }
  });

  return {
    from,
    productQuery,
    productUpdate,
    rpc,
    salesItemInsert,
    salesInsert,
    getActiveTenant: vi.fn(),
    handoverState,
  };
});

function supabaseStub() {
  return { from, rpc };
}

function actorStub(role: string) {
  return {
    supabase: supabaseStub(),
    userId: "user-1",
    orgId: "org-1",
    branchId: "branch-1",
    employeeId: "employee-1",
    role,
    subscription: null,
  };
}

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("createProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handoverState.openSessionId = "session-1";
    handoverState.pendingHandover = false;
    productQuery.data = [];
    productQuery.error = null;
    getActiveTenant.mockResolvedValue(actorStub("MASTER_ADMIN"));
  });

  it("membuat item lewat rpc pusat dengan atribut yang dikomputasi", async () => {
    const result = await createProduct({
      name: "iPhone 14 Pro",
      category: "Gadget",
      stock_qty: 4,
      cost: 15000000,
      price: 17900000,
      barcode: "BC-1",
      variant_type: "BARU",
      storage: "128 GB",
      warna: "Black",
    });

    expect(result.id).toBe("central-1");
    expect(result.sku).toBe("GD-B-128GB-BL");
    const call = rpc.mock.calls.find(([name]) => name === "create_central_item");
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      p_organization_id: "org-1",
      p_kind: "PRODUCT",
      p_sku: "GD-B-128GB-BL",
      p_name: "iPhone 14 Pro",
      p_category: "Gadget",
      p_cost: 15000000,
      p_price: 17900000,
      p_stock_qty: 4,
      p_is_serialized: false,
      p_imei: null,
      p_parent_key: "iphone-14-pro",
      p_barcode: "BC-1",
      p_variant_type: "BARU",
      p_storage: "128 GB",
      p_warna: "Black",
      p_bh_percent: null,
      p_kondisi_notes: null,
      p_garansi_days: null,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("meneruskan atribut unit bekas ke rpc pusat", async () => {
    const result = await createProduct({
      name: "iPhone 13 Pro",
      category: "Gadget",
      cost: 12000000,
      price: 14500000,
      variant_type: "BEKAS",
      storage: "64 GB",
      warna: "Black",
      imei: "356938035412345",
      bh_percent: 75,
    });

    expect(result.sku).toBe("GD-BK-64GB-2345");
    const call = rpc.mock.calls.find(([name]) => name === "create_central_item");
    expect(call?.[1]).toMatchObject({
      p_is_serialized: true,
      p_imei: "356938035412345",
      p_stock_qty: 1,
      p_bh_percent: 75,
      p_variant_type: "BEKAS",
    });
  });

  it("hanya mengizinkan master admin membuat item", async () => {
    for (const role of ["ADMIN", "FRONTLINER"]) {
      getActiveTenant.mockResolvedValue(actorStub(role));
      await expect(
        createProduct({ name: "x", category: "Gadget", cost: 1, price: 2 }),
      ).rejects.toThrow("Hanya Master Admin boleh membuat produk");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects negative cost and price", async () => {
    await expect(createProduct({ name: "x", category: "Gadget", cost: -1, price: 10 })).rejects.toThrow("Modal harus valid");
    await expect(createProduct({ name: "x", category: "Gadget", cost: 1, price: -10 })).rejects.toThrow("Harga jual harus valid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("meneruskan error rpc tanpa menerjemahkan nama constraint", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "cervise_central_items_sku_key"' },
    } as any);

    await expect(
      createProduct({
        name: "iPhone 14 Pro",
        category: "Gadget",
        stock_qty: 1,
        cost: 15000000,
        price: 17900000,
        variant_type: "BARU",
        storage: "64 GB",
        warna: "Black",
      }),
    ).rejects.toThrow("cervise_central_items_sku_key");
  });
});

describe("createSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handoverState.openSessionId = "session-1";
    handoverState.pendingHandover = false;
    productQuery.data = [];
    productQuery.error = null;
    getActiveTenant.mockResolvedValue({
      supabase: supabaseStub(),
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "FRONTLINER",
      subscription: null,
    });
  });

  it("rejects invalid sale quantities before writing", async () => {
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await expect(
      createSale({
        customerId: "customer-1",
        items: [{ product_id: "product-1", qty: -1, unit_price: 100 }],
        payment_method: "Tunai",
        paid: 0,
        kas_date: "2026-01-01",
      }),
    ).rejects.toThrow("Qty harus bilangan bulat > 0");

    expect(salesInsert).not.toHaveBeenCalled();
  });

  it("rejects non-finite prices before writing", async () => {
    getActiveTenant.mockResolvedValue({
      supabase: supabaseStub(),
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "ADMIN",
      subscription: null,
    });
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await expect(
      createSale({
        customerId: "customer-1",
        items: [{ product_id: "product-1", qty: 1, unit_price: Number.POSITIVE_INFINITY }],
        payment_method: "Tunai",
        paid: 0,
        kas_date: "2026-01-01",
      }),
    ).rejects.toThrow("Harga harus valid");

    expect(salesInsert).not.toHaveBeenCalled();
  });

  it("menolak harga yang diketik kasir di luar harga_jual", async () => {
    // Dulu test ini bernama "ignores client price tampering for frontliners" dan
    // asserting harga 1 disimpan sebagai 100. Itu bukan perilaku yang ingin
    // dijaga: keranjang mengirim paid = subtotal dari harga yang diketik, jadi
    // kasir benar-benar menerima Rp 1 sementara sistem menunggu Rp 100.000.
    // Diperbaiki dengan menolak, bukan menimpa.
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await expect(
      createSale({
        customerId: "customer-1",
        items: [{ product_id: "product-1", qty: 2, unit_price: 1 }],
        payment_method: "Tunai",
        paid: 2,
        kas_date: "2026-01-01",
      })
    ).rejects.toThrow("tidak boleh diubah");

    expect(salesInsert).not.toHaveBeenCalled();
    expect(salesItemInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("menyerahkan seluruh penulisan ke satu rpc transaksional", async () => {
    // Bug yang diuji: createSale lama menulis header, tiap item, dan finance_tx
    // sebagai permintaan terpisah. Gagal di tengah meninggalkan header dan
    // stok yang sudah turun tanpa finance_tx - Laporan Shift menghitung
    // penjualan itu (baca cervise_sales) sementara Arus Kas tidak (baca
    // finance_tx), jadi dua laporan beda tanpa error. Penurunan stok juga
    // pernah lewat RPC yang tidak menulis ledger.
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await createSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: 2, unit_price: 100 }],
      payment_method: "Tunai",
      paid: 0,
      kas_date: "2026-01-01",
    });

    // Penurunan stok TIDAK lagi dipanggil dari sini; create_sale_with_stock
    // memakai apply_stock_delta di dalam transaksinya.
    expect(rpc).not.toHaveBeenCalledWith("adjust_product_stock", expect.anything());
    expect(productUpdate).not.toHaveBeenCalled();

    const call = rpc.mock.calls.find(([name]) => name === "create_sale_with_stock");
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      p_branch_id: "branch-1",
      p_payload: expect.objectContaining({
        customer_id: "customer-1",
        payment_method: "Tunai",
        kas_date: "2026-01-01",
        items: [
          expect.objectContaining({ product_id: "product-1", qty: 2, unit_price: 100 }),
        ],
      }),
    });
  });

  it("rejects discounts from frontliners", async () => {
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await expect(
      createSale({
        customerId: "customer-1",
        items: [{ product_id: "product-1", qty: 1, unit_price: 100 }],
        payment_method: "Tunai",
        paid: 0,
        kas_date: "2026-01-01",
        discount_total: 10,
      }),
    ).rejects.toThrow("Hanya admin yang boleh memberikan diskon");
  });
});


describe("checkoutSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handoverState.openSessionId = "session-1";
    handoverState.pendingHandover = false;
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];
    productQuery.error = null;
    getActiveTenant.mockResolvedValue({
      supabase: supabaseStub(),
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "FRONTLINER",
      subscription: null,
    });
  });

  it("mengembalikan pesan error, bukan melempar, supaya tidak jadi React error 441", async () => {
    const res = await checkoutSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: -1, unit_price: 100 }],
      payment_method: "Tunai",
      kas_date: "2026-01-01",
      paid: 0,
    });

    expect(res).toEqual({ ok: false, error: "Qty harus bilangan bulat > 0" });
  });

  it("mengembalikan nomor penjualan saat berhasil", async () => {
    const res = await checkoutSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: 2, unit_price: 100 }],
      payment_method: "Tunai",
      kas_date: "2026-01-01",
      paid: 200,
    });

    expect(res).toEqual({ ok: true, saleId: "sale-1", saleNumber: "SLV-2026-0003" });
  });

  it("blocks checkout while a handover is pending", async () => {
    handoverState.pendingHandover = true;

    const res = await checkoutSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: 1, unit_price: 100 }],
      payment_method: "Tunai",
      kas_date: "2026-01-01",
      paid: 100,
    });

    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("menunggu dilanjutkan"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
