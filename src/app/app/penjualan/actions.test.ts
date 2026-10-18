import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProduct, createSale } from "./actions";

const { from, productQuery, productInsert, productUpdate, rpc, salesItemInsert, salesInsert, getActiveTenant } = vi.hoisted(() => {
  const productQuery = { data: [] as any[], error: null as any };
  const customerSingle = { data: { id: "customer-1", tags: [] } as any, error: null as any };
  const salesSingle = { data: { id: "sale-1" } as any, error: null as any };

  const productInsert = vi.fn(async () => ({ error: null, data: {} }));
  const productUpdate = vi.fn(() => {
    const chain: any = { eq: () => chain, select: async () => ({ data: [], error: null }) };
    return chain;
  });
  const customerUpdate = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const salesItemInsert = vi.fn(async () => ({ error: null }));
  const salesInsert = vi.fn((): any => ({ select: () => ({ single: async () => salesSingle }) }));
  const financeInsert = vi.fn(async () => ({ error: null }));
  // create_sale_with_stock mengembalikan objek; fungsi lain (next_sale_number)
  // mengembalikan teks. Bentuk balasan createSale dipakai di sini supaya test
  // benar-benar melewati pengecekan "id tidak kosong".
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) =>
    name === "create_sale_with_stock"
      ? { data: { id: "sale-1", sale_number: "SLV-2026-0003", total: 200 }, error: null }
      : { data: "SLV-2026-0003", error: null },
  );

  const from = vi.fn((table: string) => {
    switch (table) {
      case "cervise_products":
        return {
          insert: productInsert,
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
        return { insert: financeInsert };
      default:
        throw new Error(`unexpected table: ${table}`);
    }
  });

  return { from, productQuery, productInsert, productUpdate, rpc, salesItemInsert, salesInsert, getActiveTenant: vi.fn() };
});

function supabaseStub() {
  return { from, rpc };
}

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("createProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productInsert.mockResolvedValue({ error: null, data: {} });
    productQuery.data = [];
    productQuery.error = null;
    getActiveTenant.mockResolvedValue({
      supabase: supabaseStub(),
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "ADMIN",
      subscription: null,
    });
  });

  it("writes a product with the actor organization and product table", async () => {
    await createProduct({
      name: "iPhone 14 Pro",
      category: "Gadget",
      stock_qty: 4,
      cost: 15000000,
      price: 17900000,
      variant_type: "BARU",
      storage: "128 GB",
      warna: "Black",
    });

    expect(from).toHaveBeenCalledWith("cervise_products");
    expect(productInsert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: "org-1",
      branch_id: "branch-1",
      name: "iPhone 14 Pro",
      variant_type: "BARU",
      storage: "128 GB",
      warna: "Black",
      stock_qty: 4,
    }));
  });

  it("rejects negative cost and price", async () => {
    await expect(createProduct({ name: "x", category: "Gadget", cost: -1, price: 10 })).rejects.toThrow("Modal harus valid");
    await expect(createProduct({ name: "x", category: "Gadget", cost: 1, price: -10 })).rejects.toThrow("Harga jual harus valid");
    expect(productInsert).not.toHaveBeenCalled();
  });
});

describe("createSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

