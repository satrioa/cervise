"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { sanitizeSearchTerm } from "@/lib/search-term";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/operational/sparepart-stock";
import { numberField } from "./actions-shared";

export type SparepartRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock_qty: number;
  low_stock_threshold: number;
  cost: number;
  price: number;
  is_active: boolean;
};

export type SparepartInput = {
  sku?: string;
  name: string;
  category: string;
  stock_qty: number;
  low_stock_threshold?: number;
  cost: number;
  price: number;
};

async function getManagerActor() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Pilih cabang dulu sebelum mengelola sparepart");
  if (actor.role !== "MASTER_ADMIN") throw new Error("Hanya Master Admin");
  return actor;
}

/** UI mengirim id master, RPC stok lama butuh id baris cabang. */
async function resolveBranchStock(actor: Awaited<ReturnType<typeof getActiveTenant>>, centralItemId: string) {
  const { data, error } = await actor.supabase
    .from("cervise_spareparts")
    .select("id, stock_qty")
    .eq("central_item_id", centralItemId)
    .eq("branch_id", actor.branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Stok cabang belum ada — distribusikan dari pusat dulu");
  return { id: data.id as string, stock_qty: Number(data.stock_qty ?? 0) };
}

export async function listSpareparts(q: string): Promise<SparepartRow[]> {
  const actor = await getActiveTenant();
  if (!actor.branchId) return [];
  const term = sanitizeSearchTerm(q);

  const master = actor.supabase
    .from("cervise_central_items")
    .select("id, sku, name, category, cost, price, is_active")
    .eq("organization_id", actor.orgId)
    .eq("kind", "SPAREPART")
    .eq("is_active", true);
  const { data: items, error } = await (term ? master.or(`name.ilike.%${term}%,sku.ilike.%${term}%`) : master).order("name");
  if (error) throw new Error(error.message);

  const { data: branchRows, error: branchError } = await actor.supabase
    .from("cervise_spareparts")
    .select("central_item_id, stock_qty, low_stock_threshold")
    .eq("branch_id", actor.branchId);
  if (branchError) throw new Error(branchError.message);

  const branchById = new Map(
    (branchRows ?? []).map((row) => [row.central_item_id, {
      stock_qty: Number(row.stock_qty ?? 0),
      low_stock_threshold: Number(row.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD),
    }]),
  );
  return ((items ?? []) as Omit<SparepartRow, "stock_qty" | "low_stock_threshold">[]).map((row) => ({
    ...row,
    cost: Number(row.cost ?? 0),
    price: Number(row.price ?? 0),
    stock_qty: branchById.get(row.id)?.stock_qty ?? 0,
    low_stock_threshold: branchById.get(row.id)?.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
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

export async function createSparepart(input: SparepartInput): Promise<string> {
  const actor = await getManagerActor();
  const name = input.name?.trim();
  if (!name) throw new Error("Nama sparepart wajib");

  const { data, error } = await actor.supabase.rpc("create_central_item", {
    p_organization_id: actor.orgId,
    p_kind: "SPAREPART",
    p_sku: input.sku?.trim() || `SP-${Date.now().toString(36).toUpperCase()}`,
    p_name: name,
    p_category: input.category?.trim() || "Sparepart",
    p_cost: numberField(input.cost, "Modal"),
    p_price: numberField(input.price, "Harga jual"),
    p_stock_qty: numberField(input.stock_qty, "Stok"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
  return data as string;
}

export async function updateSparepart(id: string, input: SparepartInput): Promise<void> {
  const actor = await getManagerActor();
  const name = input.name?.trim();
  if (!name) throw new Error("Nama sparepart wajib");

  const { error } = await actor.supabase.rpc("update_central_item", {
    p_central_item_id: id,
    p_name: name,
    p_category: input.category?.trim() || "Sparepart",
    p_cost: numberField(input.cost, "Modal"),
    p_price: numberField(input.price, "Harga jual"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
}

export type PurchaseSparepartInput = {
  id: string;
  qty: number;
  unitCost: number;
};

/** Beli stok pusat; modal ikut diperbarui. */
export async function purchaseSparepartStock(input: PurchaseSparepartInput): Promise<void> {
  const actor = await getManagerActor();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0) throw new Error("Jumlah pembelian harus lebih dari nol");
  const unitCost = numberField(input.unitCost, "Harga beli");

  await resolveBranchStock(actor, input.id);

  // Stok cabang bukan stok pusat, jadi expected stock tidak dipakai di RPC pusat.
  const { error } = await actor.supabase.rpc("purchase_central_stock", {
    p_central_item_id: input.id,
    p_qty: qty,
    p_unit_cost: unitCost,
    p_expected_stock: null,
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

  const branch = await resolveBranchStock(actor, input.id);

  const { error } = await actor.supabase.rpc("transfer_sparepart_stock", {
    p_sparepart_id: branch.id,
    p_target_branch_id: input.targetBranchId,
    p_qty: qty,
    p_expected_stock: branch.stock_qty,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/sparepart");
}

export async function setSparepartActive(id: string, isActive: boolean): Promise<void> {
  const actor = await getManagerActor();
  const branch = await resolveBranchStock(actor, id);
  const { error } = await actor.supabase
    .from("cervise_spareparts")
    .update({ is_active: isActive })
    .eq("id", branch.id)
    .eq("branch_id", actor.branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function deleteSparepart(id: string): Promise<void> {
  const actor = await getManagerActor();
  const branch = await resolveBranchStock(actor, id);
  const { error } = await actor.supabase
    .from("cervise_spareparts")
    .delete()
    .eq("id", branch.id)
    .eq("branch_id", actor.branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}
