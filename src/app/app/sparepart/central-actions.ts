"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { numberField } from "./actions-shared";

export type CentralItemRow = {
  id: string; sku: string; name: string; category: string; cost: number; price: number;
  stock_qty: number; is_serialized: boolean; imei: string | null; parent_key: string | null;
  kind: "SPAREPART" | "PRODUCT";
};

export type CentralItemInput = {
  kind: "SPAREPART" | "PRODUCT"; sku: string; name: string; category: string;
  stock_qty: number; cost: number; price: number; imei?: string; parent_key?: string;
};

export type StockRequestRow = {
  id: string; sku: string; qty: number; decided_qty: number | null; status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string | null; note: string | null; branch_id: string; created_at: string;
};

async function requireMaster() {
  const actor = await getActiveTenant();
  if (actor.role !== "MASTER_ADMIN") throw new Error("Hanya Master Admin");
  return actor;
}

async function requireRequestRole() {
  const actor = await getActiveTenant();
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER"].includes(actor.role)) throw new Error("Role tidak diizinkan request stok");
  if (!actor.branchId) throw new Error("Pilih cabang dulu sebelum request stok");
  return actor;
}

export async function listCentralItems(q: string, kind?: "SPAREPART" | "PRODUCT"): Promise<CentralItemRow[]> {
  const actor = await getActiveTenant();
  let query = actor.supabase.from("cervise_central_items").select(
    "id, sku, name, category, cost, price, stock_qty, is_serialized, imei, parent_key, kind, is_active",
  ).eq("organization_id", actor.orgId).eq("is_active", true);
  if (kind) query = query.eq("kind", kind);
  if (q.trim()) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,imei.ilike.%${q}%`);
  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCentralItem(input: CentralItemInput): Promise<string> {
  const actor = await requireMaster();
  const sku = input.sku.trim();
  const name = input.name.trim();
  if (!sku || !name) throw new Error("SKU dan nama wajib");
  const { data, error } = await actor.supabase.rpc("create_central_item", {
    p_organization_id: actor.orgId,
    p_kind: input.kind, p_sku: sku, p_name: name,
    p_category: input.category || "Sparepart",
    p_cost: numberField(input.cost, "Modal"), p_price: numberField(input.price, "Harga jual"),
    p_stock_qty: numberField(input.stock_qty, "Stok"),
    p_is_serialized: input.kind === "PRODUCT" && Boolean(input.imei),
    p_imei: input.imei?.trim() || null, p_parent_key: input.parent_key?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
  return data as string;
}

export async function purchaseCentralStock(input: { id: string; qty: number; unitCost: number; expectedStock: number }): Promise<void> {
  const actor = await requireMaster();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0) throw new Error("Jumlah pembelian harus lebih dari nol");
  const { error } = await actor.supabase.rpc("purchase_central_stock", {
    p_central_item_id: input.id, p_qty: qty,
    p_unit_cost: numberField(input.unitCost, "Harga beli"),
    p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function distributeCentralStock(input: { id: string; targetBranchId: string; qty: number; expectedStock: number; imei?: string }): Promise<void> {
  const actor = await requireMaster();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0 || !input.targetBranchId) throw new Error("Pilih cabang tujuan dan jumlah");
  const { error } = await actor.supabase.rpc("distribute_central_stock", {
    p_central_item_id: input.id, p_target_branch_id: input.targetBranchId, p_qty: qty,
    p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
    p_imei: input.imei ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function listStockRequests(): Promise<StockRequestRow[]> {
  const actor = await getActiveTenant();
  const query = actor.role === "MASTER_ADMIN"
    ? actor.supabase.from("cervise_stock_requests").select("*").eq("organization_id", actor.orgId)
    : actor.supabase.from("cervise_stock_requests").select("*").eq("branch_id", actor.branchId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function requestStock(input: { sku: string; qty: number }): Promise<void> {
  const actor = await requireRequestRole();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0 || !input.sku.trim()) throw new Error("Pilih item dan isi jumlah");
  const { error } = await actor.supabase.rpc("request_stock", {
    p_branch_id: actor.branchId, p_sku: input.sku.trim(), p_qty: qty,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function approveStockRequest(input: { requestId: string; decidedQty: number; centralItemId: string; expectedStock: number }): Promise<void> {
  const actor = await requireMaster();
  const { error } = await actor.supabase.rpc("approve_stock_request", {
    p_request_id: input.requestId, p_decided_qty: numberField(input.decidedQty, "Jumlah"),
    p_central_item_id: input.centralItemId, p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function rejectStockRequest(input: { requestId: string; reason: string }): Promise<void> {
  const actor = await requireMaster();
  if (input.reason.trim().length < 3) throw new Error("Alasan penolakan minimal 3 karakter");
  const { error } = await actor.supabase.rpc("reject_stock_request", {
    p_request_id: input.requestId, p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}
