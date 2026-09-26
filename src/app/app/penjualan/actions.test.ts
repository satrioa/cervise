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
  const rpc = vi.fn(async () => ({ data: 3, error: null }));

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

  it("ignores client price tampering for frontliners", async () => {
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await createSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: 2, unit_price: 1 }],
      payment_method: "Tunai",
      paid: 200,
      kas_date: "2026-01-01",
    });

    expect(salesItemInsert).toHaveBeenCalledWith(expect.objectContaining({ unit_price: 100, line_total: 200 }));
    expect(salesInsert).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 200, total: 200 }));
  });

  it("moves stock through the validated rpc instead of a direct product update", async () => {
    productQuery.data = [{ id: "product-1", name: "Layar", stock_qty: 5, is_serialized: false, price: 100, sku: "GD1", category: "Gadget", cost: 50 }];

    await createSale({
      customerId: "customer-1",
      items: [{ product_id: "product-1", qty: 2, unit_price: 100 }],
      payment_method: "Tunai",
      paid: 0,
      kas_date: "2026-01-01",
    });

    expect(rpc).toHaveBeenCalledWith("adjust_product_stock", {
      p_product_id: "product-1",
      p_delta: -2,
      p_expected_stock: 5,
    });
    expect(productUpdate).not.toHaveBeenCalled();
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

