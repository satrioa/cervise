"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import { getActiveTenant } from "@/lib/supabase/actor";
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { canAccess } from "@/lib/rbac";
import { applyBranchScope } from "@/lib/supabase/branch-scope";
import { validateSaleItems } from "@/lib/sales/validation";
import { sanitizeSearchTerm } from "@/lib/search-term";
import { findOrCreateCustomer } from "@/app/app/customer/actions";
import { publicPhotoUrl } from "@/lib/photos";

async function getBranchUser() {
  const actor = await getActiveTenant();
  // getActiveTenant already validates is_active and tenant
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  const supabase = actor.supabase;
  return { supabase, userId: actor.userId, branchId: actor.branchId, organizationId: actor.orgId, role: actor.role, email: "" };
}

/** Konteks baca untuk POS/riwayat; mode "Semua cabang" boleh membaca. */
async function getSalesReadContext() {
  const actor = await getActiveTenant();
  return { supabase: actor.supabase, actor };
}

function requireSalesAccess(role: string) {
  if (!canAccess(role, "penjualan")) throw new Error("Hanya frontliner/admin boleh transaksi penjualan");
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
  const { supabase, actor } = await getSalesReadContext();
  const { role } = actor;
  requireSalesAccess(role);
  let query = applyBranchScope(
    supabase
      .from("cervise_products")
      .select("id, branch_id, sku, barcode, name, category, stock_qty, cost, price, is_serialized, is_active, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key")
      .eq("is_active", true),
    actor,
  )
    .order("parent_key", { ascending: true })
    .order("variant_type", { ascending: true })
    .order("name")
    .limit(40);
  const term = sanitizeSearchTerm(q);
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
    // Constraint yang bentrok adalah `cervise_products_branch_id_sku_key`, bukan
    // constraint terpisah untuk IMEI. SKU Bekas diturunkan dari 4 digit
    // terakhir IMEI (`GD-BK-64GB-2345`), jadi IMEI ganda - dan SKU sama dari
    // warna+storage yang sama - sama-sama muncul sebagai bentrok SKU.
    //
    // Ditemukan lewat test end-to-end: `includes("imei")` tidak pernah cocok
    // dengan nama constraint, jadi pesan "IMEI sudah ada di cabang ini" tidak
    // pernah muncul dan yang tampil ke pengguna pesan Postgres mentah.
    if ((error as any).code === "23505" && String(error.message).includes("cervise_products_branch_id_sku_key")) {
      throw new Error(
        variant_type === "BEKAS"
          ? "IMEI sudah dipakai unit lain di cabang ini"
          : "Varian dengan storage dan warna yang sama sudah ada di cabang ini",
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/app/penjualan");
  revalidatePath("/app/inventori");
  return { sku };
}

export async function getSalesOrders(filters?: { q?: string; metode?: string; status?: string; from?: string; to?: string }) {
  const { supabase, actor } = await getSalesReadContext();
  requireSalesAccess(actor.role);
  let q = applyBranchScope(
    supabase
      .from("cervise_sales")
      .select("id, branch_id, customer_id, sale_number, subtotal, discount_total, total, paid, returned_value, payment_status, payment_method, status, kas_date, notes, created_at, created_by"),
    actor,
  )
    .order("created_at", { ascending: false })
    .limit(100);
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
  const { supabase, actor } = await getSalesReadContext();
  requireSalesAccess(actor.role);
  const saleQuery = applyBranchScope(supabase.from("cervise_sales").select("*"), actor);
  const { data: sale, error } = await saleQuery.eq("id", saleId).maybeSingle();
  if (error || !sale) throw new Error("Sale not found");
  const { data: items } = await supabase.from("cervise_sales_items").select("*").eq("sale_id", saleId);
  const { data: cust } = sale.customer_id ? await supabase.from("cervise_customers").select("id, name, phone, address").eq("id", sale.customer_id).maybeSingle() : { data: null } as any;
  // Nama kasir untuk nota. `created_by` menunjuk profiles, bukan employees.
  const { data: cashier } = sale.created_by
    ? await supabase.from("profiles").select("full_name").eq("id", sale.created_by).maybeSingle()
    : ({ data: null } as any);
  return {
    sale: sale as any,
    items: (items as any[]) ?? [],
    customer: cust as any,
    cashier: ((cashier as any)?.full_name as string | undefined) ?? null,
  };
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
  const { data: prods, error: pErr } = await supabase.from("cervise_products").select("id, sku, name, category, stock_qty, cost, price, is_serialized, imei").in("id", pIds).eq("branch_id", branchId);
  if (pErr) throw new Error(pErr.message);
  const pMap = new Map<string, any>();
  for (const p of (prods as any[]) ?? []) pMap.set(p.id, p);

  const canOverridePrice = canAccess(role, "harga_jual");
  // Harga TIDAK lagi diganti dengan harga produk di sini. Dulu baris ini
  // menimpanya diam-diam, jadi kasir melihat "Total Rp1" di layar sementara
  // server menyimpan total Rp 100.000. validateSaleItems sekarang menolak
  // harga yang berbeda kalau role tidak punya harga_jual, jadi menimpanya
  // hanya akan menutupi penolakan itu.
  const saleItems = input.items.map((item) => ({
    ...item,
    qty: Number(item.qty),
    unit_price: Number(item.unit_price),
  }));

  validateSaleItems(
    saleItems,
    [...pMap.values()].map((product) => ({
      id: product.id,
      name: product.name,
      stock_qty: Number(product.stock_qty),
      is_serialized: Boolean(product.is_serialized),
      price: Number(product.price),
      imei: product.imei ?? null,
    })),
    { canOverridePrice },
  );

  // Sisa satu loop: cek IMEI belum dipakai di penjualan lain. Validasi
  // harga, stok, dan IMEI milik unit sudah dikerjakan validateSaleItems dan
  // diulang lagi di dalam RPC.
  for (const it of saleItems) {
    const p = pMap.get(it.product_id);
    if (p.is_serialized && it.imei1) {
      const { data: dup } = await supabase.from("cervise_sales_items").select("id").eq("is_serialized", true).contains("item_meta", { imei1: it.imei1.trim() });
      if (dup && (dup as any[]).length) throw new Error(`IMEI ${it.imei1} sudah terpakai`);
    }
  }
  const requestedDiscount = Number(input.discount_total ?? 0);
  if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) throw new Error("Diskon tidak valid");
  // Diskon tidak boleh diberikan oleh role tanpa harga_jual. RPC tidak
  // memeriksa ini: dia hanya memotong diskon dari total.
  if (!canOverridePrice && requestedDiscount > 0) throw new Error("Hanya admin yang boleh memberikan diskon");

  // Subtotal, total, paid, dan payment_status tidak lagi dihitung di sini.
  // RPC menghitung ulang semuanya dari cervise_products dalam satu transaksi;
  // nilai yang dihitung di browser tidak menentukan apa yang tersimpan dan
  // hanya bisa jadi angka yang berbeda dari yang disimpan.

  // Subtotal, total, paid, dan payment_status sekarang dihitung ulang di dalam
  // RPC dari cervise_products, jadi nilai yang dihitung di browser tidak lagi
  // menentukan apa yang tersimpan.

  // Tag "sales" ditulis setelah penjualan berhasil, bukan sebelumnya. Kalau
  // penandaan gagal, penjualan tidak ikut batal - dan kalau ada yang menekan
  // Beli dua kali, dua penjualan memang terjadi.
  const { data: sale, error: sErr } = await supabase.rpc("create_sale_with_stock", {
    p_branch_id: branchId,
    p_payload: {
      customer_id: input.customerId,
      payment_method: input.payment_method,
      kas_date: input.kas_date,
      paid: input.paid,
      discount_total: input.discount_total ?? 0,
      notes: input.notes?.trim() || "",
      promo_code: input.promoCode ?? "",
      items: saleItems.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        unit_price: item.unit_price,
        imei1: item.imei1 ?? "",
        imei2: item.imei2 ?? "",
        warna: item.warna ?? "",
      })),
    },
  });
  if (sErr) throw new Error(sErr.message);
  const result = (sale ?? {}) as { id?: string; sale_number?: string; total?: number };
  if (!result.id) throw new Error("Penjualan tidak berhasil disimpan");

  // ensure customer exists and tag sales
  const { data: cust } = await supabase.from("cervise_customers").select("id, tags").eq("id", input.customerId).eq("branch_id", branchId).maybeSingle();
  if (cust) {
    const tags = new Set<string>((cust as any)?.tags ?? []);
    tags.add("sales");
    await supabase.from("cervise_customers").update({ tags: Array.from(tags) } as any).eq("id", input.customerId);
  }

  revalidatePath("/app/penjualan");
  revalidatePath("/app/laporan/penjualan");
  return { id: result.id, sale_number: result.sale_number ?? "" };
}

export type CheckoutSaleInput = {
  customerId?: string | null;
  newCustomer?: { name: string; phone: string } | null;
  items: { product_id: string; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string }[];
  payment_method: string;
  kas_date: string;
  paid: number;
  notes?: string;
  discount_total?: number;
  promoCode?: string | null;
};

export type CheckoutSaleResult =
  | { ok: true; saleId: string; saleNumber: string }
  | { ok: false; error: string };

/**
 * Satu pintu checkout untuk POS.
 *
 * `createSale` sengaja tetap melempar error: test dan pemanggil lain
 * mengandalkan kontrak itu. Masalahnya, error yang dilempar server action
 * sampai ke browser sebagai "Minified React error #441" di build produksi —
 * pesan aslinya hilang. Fungsi ini menangkapnya dan mengembalikannya sebagai
 * nilai, jadi kasir melihat penyebab sebenarnya.
 */
export async function checkoutSale(input: CheckoutSaleInput): Promise<CheckoutSaleResult> {
  try {
    let customerId = input.customerId?.trim() || null;
    if (!customerId) {
      if (!input.newCustomer) return { ok: false, error: "Customer wajib — cari atau tambah customer baru" };
      const found = await findOrCreateCustomer({
        name: input.newCustomer.name,
        phone: input.newCustomer.phone,
      });
      customerId = found.id;
    }
    const sale = await createSale({
      customerId,
      items: input.items,
      payment_method: input.payment_method,
      kas_date: input.kas_date,
      paid: input.paid,
      notes: input.notes,
      discount_total: input.discount_total ?? 0,
      promoCode: input.promoCode ?? null,
    });
    return { ok: true, saleId: sale.id, saleNumber: sale.sale_number };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "Gagal menyimpan penjualan" };
  }
}

export type ReceiptContext = {
  brandName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  branchName: string | null;
  address: string | null;
  phone: string | null;
};

/** Identitas toko untuk kepala nota; dibaca sekali saat halaman dimuat. */
export async function getReceiptContext(): Promise<ReceiptContext> {
  const actor = await getActiveTenant();
  const { supabase, orgId, branchId } = actor;
  const [{ data: org }, branchResult] = await Promise.all([
    supabase.from("organizations").select("name, tagline, logo_url").eq("id", orgId).maybeSingle(),
    branchId
      ? supabase.from("branches").select("name, address, phone").eq("id", branchId).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);
  const branch = branchResult?.data as { name?: string; address?: string | null; phone?: string | null } | null;
  return {
    brandName: (org as any)?.name ?? null,
    tagline: (org as any)?.tagline ?? null,
    // Logo milik tenant; path divalidasi dulu supaya tidak menunjuk host lain.
    logoUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", (org as any)?.logo_url ?? null),
    branchName: branch?.name ?? null,
    address: branch?.address ?? null,
    phone: branch?.phone ?? null,
  };
}

export async function returnSaleItems(saleId: string, returns: { item_id: string; qty: number }[]) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);
  const { data: sale } = await supabase.from("cervise_sales").select("id, branch_id, status").eq("id", saleId).eq("branch_id", branchId).maybeSingle();
  if (!sale) throw new Error("Sale not found");
  if ((sale as any).status === "retur") throw new Error("Sudah retur");

  // Cek bentuk input di sini supaya pesan errornya ramah. Kebenarannya
  // (sisa retur, role, kunci baris) tetap dihitung ulang di dalam fungsi,
  // karena yang di sini dibaca tanpa lock dan bisa saja sudah basi.
  for (const r of returns) {
    if (!Number.isInteger(r.qty) || r.qty <= 0) throw new Error("Qty retur invalid");
  }

  // Seluruh penulisan dalam satu transaksi, dengan penjualan dan tiap item
  // Seluruh penulisan dalam satu transaksi, dengan penjualan dan tiap item
  // dikunci FOR UPDATE. Stok, qty_returned, nilai retur, status, dan kas
  // keluar ditulis bersama - kalau satu gagal, tidak ada yang tersisa.
  //
  // Dulu urutannya: stok dikembalikan dulu, baru qty_returned ditulis. Kalau
  // tulisan kedua gagal, stok sudah balik tanpa tercatat dan retur bisa
  // diulang indefinitely. Ditambah qty_returned dibaca tanpa lock, jadi dua
  // retur bersamaan bisa dua-duanya mengembalikan stok yang sama.
  const { data: returned, error: returnError } = await supabase.rpc(
    "return_sale_items_atomic",
    {
      p_branch_id: branchId,
      p_sale_id: saleId,
      p_items: returns.map((r) => ({ item_id: r.item_id, qty: Number(r.qty) })),
      // Tanggal bisnis WIB, bukan current_date di server UTC. Retur jam 1 pagi
      // tidak boleh tercatat sebagai kas keluar kemarin.
      p_kas_date: kalenderWIB(),
    } as any,
  );
  if (returnError) throw new Error(returnError.message);

  const result = (returned ?? {}) as { items?: number; refund?: number };
  revalidatePath("/app/penjualan");
  revalidatePath("/app/laporan/penjualan");
  return { ok: true, items: Number(result.items ?? 0), refund: Number(result.refund ?? 0) };
}
