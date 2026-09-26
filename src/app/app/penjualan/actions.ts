"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";
import { validateSaleItems } from "@/lib/sales/validation";

async function getBranchUser() {
  const actor = await getActiveTenant();
  // getActiveTenant already validates is_active and tenant
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  const supabase = actor.supabase;
  return { supabase, userId: actor.userId, branchId: actor.branchId, organizationId: actor.orgId, role: actor.role, email: "" };
}

function requireSalesAccess(role: string) {
  if (!canAccess(role, "penjualan")) throw new Error("Hanya frontliner/admin boleh transaksi penjualan");
}

function genNota(): string {
  const d = new Date();
  const ymd = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-S-${ymd}-${rand}`;
}

function genSku(category: string): string {
  const pref = category === "Gadget" ? "GD" : category === "Aksesori" ? "AK" : "PR";
  return `${pref}-${Math.floor(100 + Math.random() * 900)}-${Date.now().toString().slice(-4)}`;
}

export type ProductRow = {
  id: string;
  branch_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  stock_qty: number;
  cost: number;
  price: number;
  is_serialized: boolean;
  is_active: boolean;
  variant_type: "BARU" | "BEKAS";
  storage: string | null;
  warna: string | null;
  bh_percent: number | null;
  kondisi_notes: string | null;
  garansi_days: number | null;
  imei: string | null;
  parent_key: string | null;
};

function slugParent(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function searchProductsForSale(q: string, opts?: { variant_type?: "BARU" | "BEKAS" | "semua" }): Promise<ProductRow[]> {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  let query = supabase
    .from("cervise_products")
    .select("id, branch_id, sku, barcode, name, category, stock_qty, cost, price, is_serialized, is_active, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("parent_key", { ascending: true })
    .order("variant_type", { ascending: true })
    .order("name")
    .limit(40);
  const term = q.trim();
  if (term) {
    query = query.or(`sku.ilike.%${term}%,barcode.ilike.%${term}%,name.ilike.%${term}%,imei.ilike.%${term}%,storage.ilike.%${term}%,warna.ilike.%${term}%`);
  }
  if (opts?.variant_type && opts.variant_type !== "semua") {
    query = query.eq("variant_type", opts.variant_type);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as any[]) ?? [];
}

export async function getProductsForBranch(): Promise<ProductRow[]> {
  return searchProductsForSale("");
}

export async function createProduct(input: {
  name: string;
  category: string;
  stock_qty?: number;
  cost: number;
  price: number;
  barcode?: string;
  is_serialized?: boolean;
  variant_type?: "BARU" | "BEKAS";
  storage?: string;
  warna?: string;
  bh_percent?: number | null;
  kondisi_notes?: string | null;
  garansi_days?: number | null;
  imei?: string | null;
}) {
  const { supabase, branchId, organizationId, role } = await getBranchUser();
  const organization_id = organizationId;
  requireSalesAccess(role);
  const name = input.name.trim();
  if (!name) throw new Error("Nama produk wajib");
  if (!Number.isFinite(input.cost) || input.cost < 0) throw new Error("Modal harus valid");
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error("Harga jual harus valid");
  if (!Number.isInteger(input.stock_qty ?? 0) || (input.stock_qty ?? 0) < 0) throw new Error("Stok awal harus bilangan bulat >= 0");
  if (input.bh_percent != null && (!Number.isFinite(input.bh_percent) || input.bh_percent < 0 || input.bh_percent > 100)) {
    throw new Error("Persentase BH harus 0-100");
  }
  if (input.garansi_days != null && (!Number.isInteger(input.garansi_days) || input.garansi_days < 0)) {
    throw new Error("Garansi harus bilangan bulat >= 0");
  }
  const category = ["Gadget", "Aksesori", "Lainnya"].includes(input.category) ? input.category : "Lainnya";
  const variant_type = input.variant_type ?? (input.is_serialized ? "BEKAS" : "BARU");
  const parent_key = slugParent(name);
  let sku = genSku(category);
  let stock_qty = input.stock_qty ?? 0;
  let is_serialized = !!input.is_serialized;
  let storage: string | null = input.storage?.trim() || null;
  let warna: string | null = input.warna?.trim() || null;
  let bh_percent: number | null = input.bh_percent ?? null;
  let kondisi_notes: string | null = input.kondisi_notes?.trim() || null;
  let garansi_days: number | null = input.garansi_days ?? null;
  let imei: string | null = input.imei?.trim() || null;

  if (variant_type === "BARU") {
    if (!warna) throw new Error("Warna wajib untuk Baru");
    if (!storage) throw new Error("Storage wajib untuk Baru");
    if (stock_qty < 0) throw new Error("Stok tidak boleh negatif");
    is_serialized = false;
    imei = null;
    bh_percent = null;
    // garansi_days null for Baru (pakai global)
    sku = `${sku.split("-")[0]}-B-${storage.replace(/\s/g, "")}-${warna.slice(0, 2).toUpperCase()}`;
  } else {
    // BEKAS
    if (!imei || !/^\d{15}$/.test(imei)) throw new Error("IMEI 15 digit wajib untuk Bekas");
    if (!storage) throw new Error("Storage wajib untuk Bekas");
    if (!warna) throw new Error("Warna wajib untuk Bekas");
    if (bh_percent == null || bh_percent < 0 || bh_percent > 100) throw new Error("BH 0-100 wajib untuk Bekas");
    stock_qty = 1;
    is_serialized = true;
    sku = `${sku.split("-")[0]}-BK-${storage.replace(/\s/g, "")}-${imei.slice(-4)}`;
    // garansi_days already validated if provided
    if (garansi_days != null && garansi_days <= 0) throw new Error("Garansi harus >0 hari");
  }
  if (input.cost < 0 || input.price < 0) throw new Error("Nilai tidak boleh negatif");

  const payload: any = {
    branch_id: branchId,
    organization_id,
    sku,
    barcode: input.barcode?.trim() || null,
    name,
    category,
    stock_qty,
    cost: input.cost,
    price: input.price,
    is_serialized,
    is_active: true,
    variant_type,
    storage,
    warna,
    bh_percent,
    kondisi_notes,
    garansi_days,
    imei,
    parent_key,
  };
  const { error } = await supabase.from("cervise_products").insert(payload);
  if (error) {
    if ((error as any).code === "23505" && String(error.message).includes("imei")) throw new Error("IMEI sudah ada di cabang ini");
    throw new Error(error.message);
  }
  revalidatePath("/app/penjualan");
  revalidatePath("/app/inventori");
  return { sku };
}

export async function getSalesOrders(filters?: { q?: string; metode?: string; status?: string; from?: string; to?: string }) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  let q = supabase.from("cervise_sales").select("id, branch_id, customer_id, sale_number, subtotal, discount_total, total, paid, payment_status, payment_method, status, kas_date, notes, created_at, created_by").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(100);
  if (filters?.metode && filters.metode !== "semua") q = q.eq("payment_method", filters.metode);
  if (filters?.status && filters.status !== "semua") q = q.eq("status", filters.status);
  if (filters?.from) q = q.gte("kas_date", filters.from);
  if (filters?.to) q = q.lte("kas_date", filters.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data as any[]) ?? [];
  if (filters?.q?.trim()) {
    const term = filters.q.trim().toLowerCase();
    rows = rows.filter((r) => `${r.sale_number} ${r.notes ?? ""}`.toLowerCase().includes(term));
  }
  // enrich customer name
  const cIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  let cmap = new Map<string, { name: string; phone: string }>();
  if (cIds.length) {
    const { data: cs } = await supabase.from("cervise_customers").select("id, name, phone").in("id", cIds);
    for (const c of (cs as any[]) ?? []) cmap.set(c.id, { name: c.name, phone: c.phone });
  }
  // enrich items count
  const sIds = rows.map((r) => r.id);
  let itemMap = new Map<string, number>();
  if (sIds.length) {
    const { data: its } = await supabase.from("cervise_sales_items").select("sale_id, qty").in("sale_id", sIds);
    for (const it of (its as any[]) ?? []) itemMap.set(it.sale_id, (itemMap.get(it.sale_id) ?? 0) + it.qty);
  }
  return rows.map((r) => ({
    ...r,
    customerName: cmap.get(r.customer_id)?.name ?? "-",
    customerPhone: cmap.get(r.customer_id)?.phone ?? "",
    itemsQty: itemMap.get(r.id) ?? 0,
  }));
}

export async function getSaleDetail(saleId: string) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  const { data: sale, error } = await supabase.from("cervise_sales").select("*").eq("id", saleId).eq("branch_id", branchId).maybeSingle();
  if (error || !sale) throw new Error("Sale not found");
  const { data: items } = await supabase.from("cervise_sales_items").select("*").eq("sale_id", saleId);
  const { data: cust } = sale.customer_id ? await supabase.from("cervise_customers").select("id, name, phone, address").eq("id", sale.customer_id).maybeSingle() : { data: null } as any;
  return { sale: sale as any, items: (items as any[]) ?? [], customer: cust as any };
}

export async function createSale(input: {
  customerId: string;
  items: { product_id: string; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string }[];
  payment_method: string;
  kas_date: string;
  paid: number;
  notes?: string;
  promoCode?: string | null;
  discount_total?: number;
}) {
  const { supabase, branchId, role, userId } = await getBranchUser();
  requireSalesAccess(role);
  if (!input.customerId) throw new Error("Customer wajib");
  if (!input.items.length) throw new Error("Keranjang kosong");
  if (!["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"].includes(input.payment_method)) throw new Error("Metode invalid");
  if (!Number.isFinite(input.paid) || input.paid < 0) throw new Error("Pembayaran tidak valid");

  const pIds = input.items.map((i) => i.product_id);
  const { data: prods, error: pErr } = await supabase.from("cervise_products").select("id, sku, name, category, stock_qty, cost, price, is_serialized").in("id", pIds).eq("branch_id", branchId);
  if (pErr) throw new Error(pErr.message);
  const pMap = new Map<string, any>();
  for (const p of (prods as any[]) ?? []) pMap.set(p.id, p);

  const canOverridePrice = canAccess(role, "harga_jual");
  const saleItems = input.items.map((item) => {
    const product = pMap.get(item.product_id);
    return {
      ...item,
      qty: Number(item.qty),
      unit_price: canOverridePrice ? Number(item.unit_price) : Number(product.price),
    };
  });

  validateSaleItems(
    saleItems,
    [...pMap.values()].map((product) => ({
      id: product.id,
      name: product.name,
      stock_qty: Number(product.stock_qty),
      is_serialized: Boolean(product.is_serialized),
      price: Number(product.price),
    })),
  );

  let subtotal = 0;
  for (const it of saleItems) {
    const p = pMap.get(it.product_id);
    if (p.is_serialized && it.imei1) {
      const { data: dup } = await supabase.from("cervise_sales_items").select("id").eq("is_serialized", true).contains("item_meta", { imei1: it.imei1.trim() });
      if (dup && (dup as any[]).length) throw new Error(`IMEI ${it.imei1} sudah terpakai`);
    }
    subtotal += Number(it.qty) * Number(it.unit_price);
  }
  const requestedDiscount = Number(input.discount_total ?? 0);
  if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) throw new Error("Diskon tidak valid");
  if (!canOverridePrice && requestedDiscount > 0) throw new Error("Hanya admin yang boleh memberikan diskon");
  const discount_total = Math.max(0, Math.min(requestedDiscount, subtotal));
  const total = Math.max(0, subtotal - discount_total); // stack: promo di atas diskon per item
  if (input.payment_method !== "Tunai" && input.paid > total) {
    throw new Error("Pembayaran non-tunai tidak boleh melebihi total");
  }
  const paid = Math.min(input.paid, total);
  const payment_status = paid >= total ? "lunas" : paid > 0 ? "dp" : "belum_bayar";
  const sale_number = genNota();

  // ensure customer exists and tag sales
  const { data: cust } = await supabase.from("cervise_customers").select("id, tags").eq("id", input.customerId).eq("branch_id", branchId).maybeSingle();
  if (!cust) throw new Error("Customer tidak ditemukan");
  const tags = new Set<string>((cust as any)?.tags ?? []);
  tags.add("sales");
  await supabase.from("cervise_customers").update({ tags: Array.from(tags) } as any).eq("id", input.customerId);

  const { data: sale, error: sErr } = await supabase.from("cervise_sales").insert({
    branch_id: branchId,
    customer_id: input.customerId,
    sale_number,
    subtotal,
    discount_total,
    total,
    paid,
    payment_status,
    payment_method: input.payment_method,
    status: "selesai",
    kas_date: input.kas_date,
    notes: (input.promoCode ? `[Promo ${input.promoCode}] ` : "") + (input.notes?.trim() || ""),
    created_by: userId,
  } as any).select("id").single();
  if (sErr) throw new Error(sErr.message);
  const saleId = (sale as any).id as string;

  for (const it of saleItems) {
    const p = pMap.get(it.product_id);
    const line_total = it.qty * it.unit_price;
    const { error: iErr } = await supabase.from("cervise_sales_items").insert({
      sale_id: saleId,
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      qty: it.qty,
      cost: p.cost,
      unit_price: it.unit_price,
      line_total,
      is_serialized: p.is_serialized,
      item_meta: { imei1: it.imei1?.trim() || null, imei2: it.imei2?.trim() || null, warna: it.warna || null },
    } as any);
    if (iErr) throw new Error(iErr.message);
    const { error: stErr } = await supabase.rpc("adjust_product_stock", {
      p_product_id: p.id,
      p_delta: -it.qty,
      p_expected_stock: Number(p.stock_qty),
    });
    if (stErr) throw new Error(stErr.message);
  }

  if (paid > 0) {
    const { error: financeError } = await supabase.from("finance_tx").insert({
      branch_id: branchId,
      type: "pemasukan",
      amount: paid,
      description: `Penjualan ${sale_number}`,
      kas_date: input.kas_date,
      created_by: userId,
    } as any);
    if (financeError) throw new Error(financeError.message);
  }

  revalidatePath("/app/penjualan");
  revalidatePath("/app/laporan/penjualan");
  return { id: saleId, sale_number };
}

export async function returnSaleItems(saleId: string, returns: { item_id: string; qty: number }[]) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  const { data: sale } = await supabase.from("cervise_sales").select("id, branch_id, status").eq("id", saleId).eq("branch_id", branchId).maybeSingle();
  if (!sale) throw new Error("Sale not found");
  if ((sale as any).status === "retur") throw new Error("Sudah retur");
  for (const r of returns) {
    const { data: it } = await supabase.from("cervise_sales_items").select("id, product_id, qty, qty_returned").eq("id", r.item_id).eq("sale_id", saleId).maybeSingle();
    if (!it) throw new Error("Item not found");
    const available = (it as any).qty - (it as any).qty_returned;
    if (!Number.isInteger(r.qty) || r.qty <= 0 || r.qty > available) throw new Error("Qty retur invalid");
    const { error: stockError } = await supabase.rpc("adjust_product_stock", {
      p_product_id: (it as any).product_id,
      p_delta: r.qty,
    });
    if (stockError) throw new Error(stockError.message);
    const { error: returnError } = await supabase.from("cervise_sales_items").update({ qty_returned: (it as any).qty_returned + r.qty } as any).eq("id", r.item_id);
    if (returnError) throw new Error(returnError.message);
  }
  // cek apakah semua qty sudah retur → status retur
  const { data: allItems } = await supabase.from("cervise_sales_items").select("qty, qty_returned").eq("sale_id", saleId);
  const allReturned = (allItems as any[])?.every((it) => it.qty === it.qty_returned);
  if (allReturned) await supabase.from("cervise_sales").update({ status: "retur" } as any).eq("id", saleId);
  revalidatePath("/app/penjualan");
  return { ok: true };
}
