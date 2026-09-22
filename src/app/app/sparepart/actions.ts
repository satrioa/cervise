/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type BranchUser = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  employeeId: string;
  organizationId: string;
  branchId: string;
  role: string;
};

async function getBranchUser(): Promise<BranchUser> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: emp } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!emp?.organization_id || !emp?.branch_id) throw new Error("Employee/branch not found");
  return {
    supabase,
    userId: auth.user.id,
    employeeId: emp.id as string,
    organizationId: emp.organization_id as string,
    branchId: emp.branch_id as string,
    role: String((emp as any).role ?? ""),
  };
}

function requireAdmin(role: string) {
  if (role !== "MASTER_ADMIN" && role !== "ADMIN") throw new Error("Hanya admin boleh mengubah sparepart");
}

function genSku(): string {
  const n = Math.floor(100 + Math.random() * 900);
  return `SP-${String(n).padStart(3, "0")}`;
}

async function uniqueSku(supabase: BranchUser["supabase"], organizationId: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const sku = genSku();
    const { data } = await supabase.from("inventory_items").select("id").eq("organization_id", organizationId).eq("sku", sku).limit(1).maybeSingle();
    if (!data) return sku;
  }
  return `SP-${Date.now().toString().slice(-6)}`;
}

export type SparepartRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_cents: number;
  price_cents: number;
  min_stock: number;
  is_active: boolean;
  qty: number;
};

export async function getSpareparts(): Promise<SparepartRow[]> {
  const { supabase, organizationId, branchId } = await getBranchUser();
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, sku, name, category, unit, cost_cents, price_cents, min_stock, is_active")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  if (!items?.length) return [];
  const ids = (items as any[]).map((r) => r.id);
  const { data: stocks } = await supabase
    .from("inventory_stocks")
    .select("inventory_item_id, qty")
    .eq("branch_id", branchId)
    .in("inventory_item_id", ids);
  const qtyMap = new Map<string, number>();
  for (const s of (stocks ?? []) as any[]) qtyMap.set(s.inventory_item_id, Number(s.qty ?? 0));
  return (items as any[]).map((r) => ({
    id: r.id as string,
    sku: r.sku as string,
    name: r.name as string,
    category: (r.category as string) ?? "Lainnya",
    unit: (r.unit as string) ?? "pcs",
    cost_cents: Number(r.cost_cents ?? 0),
    price_cents: Number(r.price_cents ?? 0),
    min_stock: Number(r.min_stock ?? 0),
    is_active: Boolean(r.is_active),
    qty: qtyMap.get(r.id as string) ?? 0,
  }));
}

export async function getSparepartCategories(): Promise<string[]> {
  const { supabase, organizationId } = await getBranchUser();
  const { data } = await supabase.from("inventory_items").select("category").eq("organization_id", organizationId).eq("is_active", true);
  const set = new Set<string>();
  for (const r of (data ?? []) as any[]) if (r.category) set.add(String(r.category));
  return [...set].sort((a, b) => a.localeCompare(b, "id"));
}

export async function getBranchesForTransfer(): Promise<{ id: string; name: string }[]> {
  const { supabase, organizationId, branchId } = await getBranchUser();
  const { data } = await supabase.from("branches").select("id, name").eq("organization_id", organizationId).eq("is_active", true).order("name");
  return ((data ?? []) as any[]).filter((b) => b.id !== branchId).map((b) => ({ id: String(b.id), name: String(b.name) }));
}

export type CreateSparepartInput = {
  name: string;
  category: string;
  unit?: string;
  costCents: number;
  priceCents: number;
  minStock: number;
  openingQty: number;
};

export async function createSparepart(input: CreateSparepartInput) {
  const { supabase, organizationId, branchId, role } = await getBranchUser();
  requireAdmin(role);
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi");
  if (input.costCents < 0 || input.priceCents < 0) throw new Error("Harga tidak boleh negatif");
  if (input.minStock < 0 || input.openingQty < 0) throw new Error("Stok tidak boleh negatif");
  const category = input.category.trim() || "Lainnya";
  const unit = (input.unit ?? "pcs").trim() || "pcs";
  const sku = await uniqueSku(supabase, organizationId);
  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: organizationId,
      sku,
      name,
      category,
      unit,
      cost_cents: Math.floor(input.costCents),
      price_cents: Math.floor(input.priceCents),
      min_stock: Math.floor(input.minStock),
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const itemId = (item as any).id as string;
  if (input.openingQty > 0) {
    const q = Math.floor(input.openingQty);
    await supabase.from("inventory_stocks").upsert({ branch_id: branchId, inventory_item_id: itemId, qty: q }, { onConflict: "branch_id,inventory_item_id" });
    await supabase.from("inventory_movements").insert({
      organization_id: organizationId,
      branch_id: branchId,
      inventory_item_id: itemId,
      qty_delta: q,
      reason: "purchase",
      notes: `Stok awal ${name}`,
    });
  } else {
    await supabase.from("inventory_stocks").upsert({ branch_id: branchId, inventory_item_id: itemId, qty: 0 }, { onConflict: "branch_id,inventory_item_id" });
  }
  revalidatePath("/app/sparepart");
  return { id: itemId, sku };
}

export type UpdateSparepartInput = {
  id: string;
  name: string;
  category: string;
  unit?: string;
  costCents: number;
  priceCents: number;
  minStock: number;
};

export async function updateSparepart(input: UpdateSparepartInput) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireAdmin(role);
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi");
  const category = input.category.trim() || "Lainnya";
  const unit = (input.unit ?? "pcs").trim() || "pcs";
  const { error } = await supabase
    .from("inventory_items")
    .update({
      name,
      category,
      unit,
      cost_cents: Math.floor(input.costCents),
      price_cents: Math.floor(input.priceCents),
      min_stock: Math.floor(input.minStock),
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
  return { ok: true as const };
}

export async function adjustStock(opts: { id: string; delta: number; notes?: string }) {
  const { supabase, organizationId, branchId, role } = await getBranchUser();
  requireAdmin(role);
  const delta = Math.floor(Number(opts.delta));
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Jumlah tidak valid");
  if (delta < 0) throw new Error("Gunakan transfer/penjualan untuk mengurangi stok");
  const { data: item } = await supabase.from("inventory_items").select("id").eq("id", opts.id).eq("organization_id", organizationId).maybeSingle();
  if (!item) throw new Error("Sparepart tidak ditemukan");
  const { data: cur } = await supabase.from("inventory_stocks").select("qty").eq("branch_id", branchId).eq("inventory_item_id", opts.id).maybeSingle();
  const next = (cur ? Number((cur as any).qty) : 0) + delta;
  await supabase.from("inventory_stocks").upsert({ branch_id: branchId, inventory_item_id: opts.id, qty: next }, { onConflict: "branch_id,inventory_item_id" });
  await supabase.from("inventory_movements").insert({
    organization_id: organizationId,
    branch_id: branchId,
    inventory_item_id: opts.id,
    qty_delta: delta,
    reason: "purchase",
    notes: opts.notes?.trim() || "Tambah stok",
  });
  revalidatePath("/app/sparepart");
  return { qty: next };
}

export async function transferStock(opts: { id: string; toBranchId: string; qty: number; notes?: string }) {
  const { supabase, organizationId, branchId, role } = await getBranchUser();
  requireAdmin(role);
  const qty = Math.floor(Number(opts.qty));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Qty harus >0");
  if (!opts.toBranchId || opts.toBranchId === branchId) throw new Error("Cabang tujuan tidak valid");
  const { data: item } = await supabase.from("inventory_items").select("id").eq("id", opts.id).eq("organization_id", organizationId).maybeSingle();
  if (!item) throw new Error("Sparepart tidak ditemukan");
  const { data: dest } = await supabase.from("branches").select("id").eq("id", opts.toBranchId).eq("organization_id", organizationId).maybeSingle();
  if (!dest) throw new Error("Cabang tujuan tidak ditemukan");
  const { data: cur } = await supabase.from("inventory_stocks").select("qty").eq("branch_id", branchId).eq("inventory_item_id", opts.id).maybeSingle();
  const have = cur ? Number((cur as any).qty) : 0;
  if (qty > have) throw new Error(`Stok cabang ini sisa ${have}, diminta ${qty}`);
  const { data: destCur } = await supabase.from("inventory_stocks").select("qty").eq("branch_id", opts.toBranchId).eq("inventory_item_id", opts.id).maybeSingle();
  const destHave = destCur ? Number((destCur as any).qty) : 0;
  await supabase.from("inventory_stocks").upsert({ branch_id: branchId, inventory_item_id: opts.id, qty: have - qty }, { onConflict: "branch_id,inventory_item_id" });
  await supabase.from("inventory_stocks").upsert({ branch_id: opts.toBranchId, inventory_item_id: opts.id, qty: destHave + qty }, { onConflict: "branch_id,inventory_item_id" });
  const note = opts.notes?.trim() || "Transfer stok";
  await supabase.from("inventory_movements").insert({
    organization_id: organizationId,
    branch_id: branchId,
    inventory_item_id: opts.id,
    qty_delta: -qty,
    reason: "transfer_out",
    notes: note,
  });
  await supabase.from("inventory_movements").insert({
    organization_id: organizationId,
    branch_id: opts.toBranchId,
    inventory_item_id: opts.id,
    qty_delta: qty,
    reason: "transfer_in",
    notes: note,
  });
  revalidatePath("/app/sparepart");
  return { ok: true as const };
}

export async function archiveSparepart(id: string, active: boolean) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireAdmin(role);
  const { error } = await supabase.from("inventory_items").update({ is_active: active }).eq("id", id).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
  return { ok: true as const };
}

export async function deleteSparepart(id: string) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireAdmin(role);
  const { data: used1 } = await supabase.from("repair_order_items").select("id").eq("organization_id", organizationId).eq("inventory_item_id", id).limit(1);
  if ((used1 ?? []).length > 0) throw new Error("Tidak bisa hapus — sparepart pernah dipakai di servis");
  const { data: used2 } = await supabase.from("inventory_movements").select("id").eq("organization_id", organizationId).eq("inventory_item_id", id).limit(1);
  if ((used2 ?? []).length > 0) throw new Error("Tidak bisa hapus — ada riwayat stok. Arsipkan saja.");
  await supabase.from("inventory_stocks").delete().eq("inventory_item_id", id);
  const { error } = await supabase.from("inventory_items").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
  return { ok: true as const };
}
