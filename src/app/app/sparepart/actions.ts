"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { sanitizeSearchTerm } from "@/lib/search-term";

export type SparepartRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock_qty: number;
  cost: number;
  price: number;
  is_active: boolean;
};

export type SparepartInput = {
  sku?: string;
  name: string;
  category: string;
  stock_qty: number;
  cost: number;
  price: number;
};

const COLUMNS = "id, sku, name, category, stock_qty, cost, price, is_active";

async function getManagerActor() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Pilih cabang dulu sebelum mengelola sparepart");
  if (!["MASTER_ADMIN", "ADMIN"].includes(actor.role)) {
    throw new Error("Hanya admin yang boleh mengubah sparepart");
  }
  return actor;
}

function numberField(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} harus bilangan bulat >= 0`);
  return n;
}

export async function listSpareparts(q: string): Promise<SparepartRow[]> {
  const actor = await getActiveTenant();
  if (!actor.branchId) return [];
  const term = sanitizeSearchTerm(q);

  let query = actor.supabase
    .from("cervise_spareparts")
    .select(COLUMNS)
    .eq("branch_id", actor.branchId);

  if (term) {
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);

  return ((data ?? []) as SparepartRow[]).map((row) => ({
    ...row,
    stock_qty: Number(row.stock_qty ?? 0),
    cost: Number(row.cost ?? 0),
    price: Number(row.price ?? 0),
  }));
}

export async function listSparepartCategories(): Promise<string[]> {
  const actor = await getActiveTenant();
  if (!actor.branchId) return ["Sparepart"];
  const { data, error } = await actor.supabase
    .from("cervise_sparepart_categories")
    .select("name")
    .eq("branch_id", actor.branchId)
    .order("name");
  if (error) throw new Error(error.message);
  const names = ((data ?? []) as { name: string }[]).map((row) => row.name);
  return names.includes("Sparepart") ? names : ["Sparepart", ...names];
}

export async function createSparepart(input: SparepartInput): Promise<SparepartRow> {
  const actor = await getManagerActor();
  const name = input.name?.trim();
  if (!name) throw new Error("Nama sparepart wajib");

  const payload = {
    organization_id: actor.orgId,
    branch_id: actor.branchId,
    sku: input.sku?.trim() || `SP-${Date.now().toString(36).toUpperCase()}`,
    name,
    category: input.category?.trim() || "Sparepart",
    stock_qty: numberField(input.stock_qty, "Stok"),
    cost: numberField(input.cost, "Modal"),
    price: numberField(input.price, "Harga jual"),
    is_active: true,
  };

  const { data, error } = await actor.supabase
    .from("cervise_spareparts")
    .insert(payload)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
  return data as SparepartRow;
}

export async function updateSparepart(id: string, input: SparepartInput): Promise<void> {
  const actor = await getManagerActor();
  const name = input.name?.trim();
  if (!name) throw new Error("Nama sparepart wajib");

  const { data: current, error: readError } = await actor.supabase
    .from("cervise_spareparts")
    .select("stock_qty")
    .eq("id", id)
    .eq("branch_id", actor.branchId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Sparepart tidak ditemukan");

  const nextStock = numberField(input.stock_qty, "Stok");
  const { error } = await actor.supabase
    .from("cervise_spareparts")
    .update({
      sku: input.sku?.trim() || undefined,
      name,
      category: input.category?.trim() || "Sparepart",
      cost: numberField(input.cost, "Modal"),
      price: numberField(input.price, "Harga jual"),
    })
    .eq("id", id)
    .eq("branch_id", actor.branchId);
  if (error) throw new Error(error.message);

  // stock_qty sengaja tidak di-grant ke klien; selisihnya lewat RPC ber-ledger.
  const delta = nextStock - Number(current.stock_qty ?? 0);
  if (delta !== 0) {
    const { error: stockError } = await actor.supabase.rpc("adjust_sparepart_stock", {
      p_sparepart_id: id,
      p_delta: delta,
      p_expected_stock: Number(current.stock_qty ?? 0),
    });
    if (stockError) throw new Error(stockError.message);
  }

  revalidatePath("/app/sparepart");
}

export type PurchaseSparepartInput = {
  id: string;
  qty: number;
  unitCost: number;
};

/** Beli stok baru; modal ikut diperbarui. Ledger mencatat reason `purchase`. */
export async function purchaseSparepartStock(input: PurchaseSparepartInput): Promise<void> {
  const actor = await getManagerActor();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0) throw new Error("Jumlah pembelian harus lebih dari nol");
  const unitCost = numberField(input.unitCost, "Harga beli");

  const { data: current, error: readError } = await actor.supabase
    .from("cervise_spareparts")
    .select("stock_qty")
    .eq("id", input.id)
    .eq("branch_id", actor.branchId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Sparepart tidak ditemukan");

  const { error } = await actor.supabase.rpc("purchase_sparepart_stock", {
    p_sparepart_id: input.id,
    p_qty: qty,
    p_unit_cost: unitCost,
    p_expected_stock: Number(current.stock_qty ?? 0),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
}

export async function transferSparepartStock(input: {
  id: string;
  targetBranchId: string;
  qty: number;
}): Promise<void> {
  const actor = await getManagerActor();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0) throw new Error("Jumlah transfer harus lebih dari nol");
  if (!input.targetBranchId || input.targetBranchId === "all") throw new Error("Pilih cabang tujuan");

  const { data: current, error: readError } = await actor.supabase
    .from("cervise_spareparts")
    .select("stock_qty")
    .eq("id", input.id)
    .eq("branch_id", actor.branchId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Sparepart tidak ditemukan");

  const { error } = await actor.supabase.rpc("transfer_sparepart_stock", {
    p_sparepart_id: input.id,
    p_target_branch_id: input.targetBranchId,
    p_qty: qty,
    p_expected_stock: Number(current.stock_qty ?? 0),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
}

export async function setSparepartActive(id: string, isActive: boolean): Promise<void> {  const actor = await getManagerActor();
  const { error } = await actor.supabase
    .from("cervise_spareparts")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("branch_id", actor.branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function deleteSparepart(id: string): Promise<void> {
  const actor = await getManagerActor();
  const { error } = await actor.supabase
    .from("cervise_spareparts")
    .delete()
    .eq("id", id)
    .eq("branch_id", actor.branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}
