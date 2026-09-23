"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

async function getBranchUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: prof } = await supabase.from("cervise_profiles").select("id, branch_id, role").eq("id", auth.user.id).maybeSingle();
  if (!prof?.branch_id) throw new Error("Branch not set for user");
  return { supabase, userId: auth.user.id, branchId: prof.branch_id as string, role: (prof.role as string) ?? "teknisi", email: auth.user.email ?? "" };
}

function requireSalesAccess(role: string) {
  const r = role.toLowerCase();
  if (!["super_owner", "master_admin", "admin", "frontliner"].includes(r)) throw new Error("Hanya frontliner/admin boleh transaksi penjualan");
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
};

export async function searchProductsForSale(q: string): Promise<ProductRow[]> {
  const { supabase, branchId } = await getBranchUser();
  let query = supabase.from("cervise_products").select("id, branch_id, sku, barcode, name, category, stock_qty, cost, price, is_serialized, is_active").eq("branch_id", branchId).eq("is_active", true).order("name").limit(20);
  const term = q.trim();
  if (term) {
    // search sku/barcode/name ilike
    query = query.or(`sku.ilike.%${term}%,barcode.ilike.%${term}%,name.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as any[]) ?? [];
}

export async function getProductsForBranch(): Promise<ProductRow[]> {
  return searchProductsForSale("");
}

export async function createProduct(input: { name: string; category: string; stock_qty: number; cost: number; price: number; barcode?: string; is_serialized?: boolean }) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  const name = input.name.trim();
  if (!name) throw new Error("Nama produk wajib");
  if (input.stock_qty < 0 || input.cost < 0 || input.price < 0) throw new Error("Nilai tidak boleh negatif");
  const category = ["Gadget", "Aksesori", "Lainnya"].includes(input.category) ? input.category : "Lainnya";
  const sku = genSku(category);
  const { error } = await supabase.from("cervise_products").insert({
    branch_id: branchId,
    sku,
    barcode: input.barcode?.trim() || null,
    name,
    category,
    stock_qty: input.stock_qty,
    cost: input.cost,
    price: input.price,
    is_serialized: !!input.is_serialized,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/penjualan");
  return { sku };
}

export async function getSalesOrders(filters?: { q?: string; metode?: string; status?: string; from?: string; to?: string }) {
  const { supabase, branchId } = await getBranchUser();
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
  const { supabase, branchId } = await getBranchUser();
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
}) {
  const { supabase, branchId, role, userId } = await getBranchUser();
  requireSalesAccess(role);
  if (!input.customerId) throw new Error("Customer wajib");
  if (!input.items.length) throw new Error("Keranjang kosong");
  if (!["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"].includes(input.payment_method)) throw new Error("Metode invalid");

  // validate stock & snapshot
  const pIds = input.items.map((i) => i.product_id);
  const { data: prods, error: pErr } = await supabase.from("cervise_products").select("id, sku, name, category, stock_qty, cost, price, is_serialized").in("id", pIds).eq("branch_id", branchId);
  if (pErr) throw new Error(pErr.message);
  const pMap = new Map<string, any>();
  for (const p of (prods as any[]) ?? []) pMap.set(p.id, p);
  let subtotal = 0;
  for (const it of input.items) {
    const p = pMap.get(it.product_id);
    if (!p) throw new Error("Produk tidak ditemukan");
    if (p.is_serialized && it.qty !== 1) throw new Error(`${p.name} wajib qty 1 (IMEI)`);
    if (it.qty > p.stock_qty) throw new Error(`Stok ${p.name} tidak cukup (sisa ${p.stock_qty})`);
    if (it.unit_price < 0) throw new Error("Harga tidak valid");
    if (p.is_serialized && !it.imei1?.trim()) throw new Error(`IMEI wajib untuk ${p.name}`);
    // cek imei duplikat di sales_items
    if (it.imei1) {
      const { data: dup } = await supabase.from("cervise_sales_items").select("id").eq("is_serialized", true).contains("item_meta", { imei1: it.imei1.trim() });
      if (dup && (dup as any[]).length) throw new Error(`IMEI ${it.imei1} sudah terpakai`);
    }
    subtotal += it.qty * it.unit_price;
  }
  const total = subtotal; // diskon per item sudah di unit_price, voucher per nota future (discount_total 0)
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
    discount_total: 0,
    total,
    paid,
    payment_status,
    payment_method: input.payment_method,
    status: "selesai",
    kas_date: input.kas_date,
    notes: input.notes?.trim() || null,
    created_by: userId,
  } as any).select("id").single();
  if (sErr) throw new Error(sErr.message);
  const saleId = (sale as any).id as string;

  for (const it of input.items) {
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
    // kurangi stok
    const { error: stErr } = await supabase.from("cervise_products").update({ stock_qty: p.stock_qty - it.qty } as any).eq("id", p.id).eq("branch_id", branchId);
    if (stErr) throw new Error(stErr.message);
  }

  if (paid > 0) {
    await supabase.from("cervise_finance_tx").insert({ branch_id: branchId, type: "pemasukan", amount: paid, description: `Penjualan ${sale_number}`, kas_date: input.kas_date, created_by: userId } as any);
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
    if (r.qty <= 0 || r.qty > available) throw new Error("Qty retur invalid");
    // kembalikan stok
    const { data: prod } = await supabase.from("cervise_products").select("stock_qty").eq("id", (it as any).product_id).eq("branch_id", branchId).maybeSingle();
    await supabase.from("cervise_products").update({ stock_qty: ((prod as any)?.stock_qty ?? 0) + r.qty } as any).eq("id", (it as any).product_id);
    await supabase.from("cervise_sales_items").update({ qty_returned: (it as any).qty_returned + r.qty } as any).eq("id", r.item_id);
  }
  // cek apakah semua qty sudah retur → status retur
  const { data: allItems } = await supabase.from("cervise_sales_items").select("qty, qty_returned").eq("sale_id", saleId);
  const allReturned = (allItems as any[])?.every((it) => it.qty === it.qty_returned);
  if (allReturned) await supabase.from("cervise_sales").update({ status: "retur" } as any).eq("id", saleId);
  revalidatePath("/app/penjualan");
  return { ok: true };
}
