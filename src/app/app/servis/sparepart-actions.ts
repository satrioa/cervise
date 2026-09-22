"use server";

import { createClient } from "@/lib/supabase/server";

type BranchUser = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; employeeId: string; organizationId: string; branchId: string };

async function getBranchUser(): Promise<BranchUser> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: emp } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!emp?.organization_id || !emp?.branch_id) throw new Error("Employee/branch not found");
  return { supabase, userId: auth.user.id, employeeId: emp.id as string, organizationId: emp.organization_id as string, branchId: emp.branch_id as string };
}

export type SparepartStockRow = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  price_cents: number;
  cost_cents: number;
};

export async function searchSparepartStock(q: string): Promise<SparepartStockRow[]> {
  const { supabase, organizationId, branchId } = await getBranchUser();
  const term = q.trim();
  // fetch inventory_items + stocks for this org/branch
  // We use two queries then join client side to keep RLS simple
  let itemsQuery = supabase
    .from("inventory_items")
    .select("id, sku, name, price_cents, cost_cents")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .limit(50);
  if (term) itemsQuery = itemsQuery.ilike("name", `%${term}%`);
  const { data: items, error: itemsErr } = await itemsQuery;
  if (itemsErr) throw new Error(itemsErr.message);
  if (!items?.length) return [];
  const ids = items.map((i: any) => i.id);
  const { data: stocks, error: stocksErr } = await supabase
    .from("inventory_stocks")
    .select("inventory_item_id, qty")
    .eq("branch_id", branchId)
    .in("inventory_item_id", ids);
  if (stocksErr) throw new Error(stocksErr.message);
  const qtyMap = new Map<string, number>();
  for (const s of (stocks ?? []) as any[]) qtyMap.set(s.inventory_item_id, Number(s.qty));
  // also include SKU search locally if term matches SKU but name didn't
  let filtered = items as any[];
  if (term) {
    const tl = term.toLowerCase();
    filtered = filtered.filter((it) => it.name.toLowerCase().includes(tl) || it.sku.toLowerCase().includes(tl));
  }
  return filtered.map((it: any) => ({
    id: it.id as string,
    sku: it.sku as string,
    name: it.name as string,
    qty: qtyMap.get(it.id as string) ?? 0,
    price_cents: Number(it.price_cents ?? 0),
    cost_cents: Number(it.cost_cents ?? 0),
  }));
}

export type ServisSparepartRow = {
  id: string;
  inventory_item_id: string | null;
  description: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number | null;
  created_at: string;
  sku: string | null;
  name: string | null;
  is_returned?: boolean | null;
};

export async function getServisSpareparts(servisId: string): Promise<ServisSparepartRow[]> {
  const { supabase, organizationId } = await getBranchUser();
  if (!servisId) return [];
  const { data, error } = await supabase
    .from("repair_order_items")
    .select("id, inventory_item_id, description, qty, unit_price_cents, line_total_cents, created_at")
    .eq("organization_id", organizationId)
    .eq("order_id", servisId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];
  const itemIds = rows.map((r) => r.inventory_item_id).filter(Boolean) as string[];
  let meta = new Map<string, { sku: string; name: string }>();
  if (itemIds.length) {
    const { data: items } = await supabase.from("inventory_items").select("id, sku, name").in("id", itemIds).eq("organization_id", organizationId);
    for (const it of (items ?? []) as any[]) meta.set(it.id, { sku: it.sku, name: it.name });
  }
  return rows.map((r) => ({
    id: r.id as string,
    inventory_item_id: r.inventory_item_id as string | null,
    description: r.description as string,
    qty: Number(r.qty),
    unit_price_cents: Number(r.unit_price_cents),
    line_total_cents: r.line_total_cents != null ? Number(r.line_total_cents) : null,
    created_at: r.created_at as string,
    sku: r.inventory_item_id ? (meta.get(r.inventory_item_id as string)?.sku ?? null) : null,
    name: r.inventory_item_id ? (meta.get(r.inventory_item_id as string)?.name ?? null) : r.description as string,
    is_returned: (r as any).is_returned ?? null,
  }));
}

type UseItemsInput = { inventory_item_id: string; qty: number }[];

async function consumeStockAndInsert(opts: {
  servisId: string;
  items: UseItemsInput;
  newDbStatus?: string | null; // if set, also update repair_orders.status
}) {
  const { supabase, organizationId, branchId, userId } = await getBranchUser();
  const { servisId, items, newDbStatus } = opts;
  if (items.length === 0 && !newDbStatus) return { ok: true as const };

  // Validate servis belongs to org
  const { data: order, error: orderErr } = await supabase.from("repair_orders").select("id, organization_id, branch_id, status").eq("id", servisId).eq("organization_id", organizationId).single();
  if (orderErr || !order) throw new Error("Servis tidak ditemukan");

  if (items.length > 0) {
    for (const it of items) {
      if (!it.inventory_item_id || it.qty <= 0) throw new Error("Qty harus >0");
    }
    // Fetch stocks & item meta
    const ids = items.map((i) => i.inventory_item_id);
    const { data: stocks, error: stocksErr } = await supabase.from("inventory_stocks").select("inventory_item_id, qty").eq("branch_id", branchId).in("inventory_item_id", ids);
    if (stocksErr) throw new Error(stocksErr.message);
    const qtyMap = new Map<string, number>();
    for (const s of (stocks ?? []) as any[]) qtyMap.set(s.inventory_item_id, Number(s.qty));
    const { data: invItems, error: invErr } = await supabase.from("inventory_items").select("id, name, price_cents, cost_cents").in("id", ids).eq("organization_id", organizationId);
    if (invErr) throw new Error(invErr.message);
    const meta = new Map<string, { name: string; price_cents: number }>();
    for (const it of (invItems ?? []) as any[]) meta.set(it.id, { name: it.name, price_cents: Number(it.price_cents ?? 0) });

    // Validate enough stock
    for (const it of items) {
      const avail = qtyMap.get(it.inventory_item_id) ?? 0;
      if (it.qty > avail) {
        const nm = meta.get(it.inventory_item_id)?.name ?? it.inventory_item_id.slice(0, 8);
        throw new Error(`Stok ${nm} sisa ${avail}, diminta ${it.qty}`);
      }
    }

    // Decrement stocks one by one (no RPC; sequential but ok for low contention; check again via update condition)
    for (const it of items) {
      const cur = qtyMap.get(it.inventory_item_id) ?? 0;
      const nextQty = cur - it.qty;
      const { error: updErr } = await supabase.from("inventory_stocks").update({ qty: nextQty }).eq("branch_id", branchId).eq("inventory_item_id", it.inventory_item_id);
      if (updErr) throw new Error(updErr.message);
      // If row didn't exist (qtyMap miss) we inserted 0 before; handle upsert case: if no row, insert
      if ((stocks ?? []).find((s: any) => s.inventory_item_id === it.inventory_item_id) == null && cur === 0) {
        // we already updated 0 rows; try upsert
        if (updErr) {
          const { error: insErr } = await supabase.from("inventory_stocks").insert({ branch_id: branchId, inventory_item_id: it.inventory_item_id, qty: 0 });
          if (insErr && !String(insErr.message).includes("duplicate")) throw new Error(insErr.message);
        }
      }
    }

    // Insert repair_order_items + inventory_movements
    for (const it of items) {
      const m = meta.get(it.inventory_item_id);
      const desc = m?.name ?? "Sparepart";
      const unit = m?.price_cents ?? 0;
      const { error: roiErr } = await supabase.from("repair_order_items").insert({
        organization_id: organizationId,
        order_id: servisId,
        inventory_item_id: it.inventory_item_id,
        description: desc,
        qty: it.qty,
        unit_price_cents: unit,
      });
      if (roiErr) throw new Error(roiErr.message);
      const { error: movErr } = await supabase.from("inventory_movements").insert({
        organization_id: organizationId,
        branch_id: branchId,
        inventory_item_id: it.inventory_item_id,
        repair_order_id: servisId,
        qty_delta: -it.qty,
        reason: "repair_use",
        notes: `Dipakai servis ${servisId.slice(0, 8)}`,
      });
      if (movErr) throw new Error(movErr.message);
    }
  }

  if (newDbStatus) {
    const { error: stErr } = await supabase.from("repair_orders").update({ status: newDbStatus }).eq("id", servisId).eq("organization_id", organizationId);
    if (stErr) throw new Error(stErr.message);
    const { error: histErr } = await supabase.from("repair_status_history").insert({ organization_id: organizationId, order_id: servisId, old_status: (order as any).status, new_status: newDbStatus, changed_by: userId });
    if (histErr) throw new Error(histErr.message);
  }

  return { ok: true as const };
}

export async function useSparepartsForServis(servisId: string, items: UseItemsInput) {
  // Called when transitioning to Dikerjakan (in_repair). Items may be empty -> just change status
  const newStatus = "in_repair";
  return consumeStockAndInsert({ servisId, items: items ?? [], newDbStatus: newStatus });
}

export async function addSparepartsToServis(servisId: string, items: UseItemsInput) {
  if (!items || items.length === 0) throw new Error("Pilih minimal 1 sparepart");
  const { supabase, organizationId } = await getBranchUser();
  const { data: order } = await supabase.from("repair_orders").select("status").eq("id", servisId).eq("organization_id", organizationId).single();
  const st = (order as any)?.status as string | undefined;
  // Only allow while Dikerjakan (in_repair). After Selesai (quality_control/ready) or Sudah Diambil (picked_up) blocked.
  if (st !== "in_repair") throw new Error("Hanya bisa tambah sparepart saat status Dikerjakan");
  return consumeStockAndInsert({ servisId, items, newDbStatus: null });
}

export async function cancelServisWithSpareparts(servisId: string, decision: "return" | "keep_consumed") {
  const { supabase, organizationId, branchId, userId } = await getBranchUser();
  const { data: order, error: orderErr } = await supabase.from("repair_orders").select("id, organization_id, branch_id, status").eq("id", servisId).eq("organization_id", organizationId).single();
  if (orderErr || !order) throw new Error("Servis tidak ditemukan");
  const cur = (order as any).status as string;
  if (cur === "cancelled") return { ok: true as const, already: true as const };
  // Fetch items for this order
  const { data: items, error: itemsErr } = await supabase.from("repair_order_items").select("id, inventory_item_id, qty").eq("organization_id", organizationId).eq("order_id", servisId);
  if (itemsErr) throw new Error(itemsErr.message);

  if (decision === "return" && items && items.length > 0) {
    for (const r of items as any[]) {
      if (!r.inventory_item_id) continue;
      // increment stock
      const { data: stock } = await supabase.from("inventory_stocks").select("qty").eq("branch_id", branchId).eq("inventory_item_id", r.inventory_item_id).maybeSingle();
      const curQty = stock ? Number((stock as any).qty) : 0;
      if (stock) {
        const { error: updErr } = await supabase.from("inventory_stocks").update({ qty: curQty + Number(r.qty) }).eq("branch_id", branchId).eq("inventory_item_id", r.inventory_item_id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: insErr } = await supabase.from("inventory_stocks").insert({ branch_id: branchId, inventory_item_id: r.inventory_item_id, qty: Number(r.qty) });
        if (insErr) throw new Error(insErr.message);
      }
      const { error: movErr } = await supabase.from("inventory_movements").insert({
        organization_id: organizationId,
        branch_id: branchId,
        inventory_item_id: r.inventory_item_id,
        repair_order_id: servisId,
        qty_delta: Number(r.qty),
        reason: "return",
        notes: `Batal servis – kembali stok ${servisId.slice(0, 8)}`,
      });
      if (movErr) throw new Error(movErr.message);
    }
    // mark returned if column exists (ignore error if not)
    try {
      await supabase.from("repair_order_items").update({ is_returned: true } as any).eq("organization_id", organizationId).eq("order_id", servisId);
    } catch {}
  } else if (decision === "keep_consumed") {
    try {
      await supabase.from("repair_order_items").update({ is_returned: false } as any).eq("organization_id", organizationId).eq("order_id", servisId);
    } catch {}
  }

  const { error: stErr } = await supabase.from("repair_orders").update({ status: "cancelled" }).eq("id", servisId).eq("organization_id", organizationId);
  if (stErr) throw new Error(stErr.message);
  const { error: histErr } = await supabase.from("repair_status_history").insert({ organization_id: organizationId, order_id: servisId, old_status: cur, new_status: "cancelled", changed_by: userId });
  if (histErr) throw new Error(histErr.message);
  return { ok: true as const };
}

export async function updateServisStatus(servisId: string, nextUiStatus: string) {
  const { supabase, organizationId, userId } = await getBranchUser();
  // simple status change without sparepart logic (for non-Dikerjakan/Batal)
  const map: Record<string, string> = {
    Masuk: "received",
    Diagnosa: "diagnosed",
    "Menunggu Konfirmasi": "waiting_approval",
    "Menunggu Sparepart": "waiting_part",
    Dikerjakan: "in_repair",
    Selesai: "ready",
    "Sudah Diambil": "picked_up",
    Batal: "cancelled",
  };
  const dbStatus = (map as any)[nextUiStatus];
  if (!dbStatus) throw new Error("Status tidak dikenal");
  const { data: order } = await supabase.from("repair_orders").select("status").eq("id", servisId).eq("organization_id", organizationId).single();
  const old = (order as any)?.status ?? null;
  if (old === dbStatus) return { ok: true as const };
  // guard: Selesai/Sudah Diambil already handled; but allow here for non-sparepart paths
  const { error } = await supabase.from("repair_orders").update({ status: dbStatus }).eq("id", servisId).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  await supabase.from("repair_status_history").insert({ organization_id: organizationId, order_id: servisId, old_status: old, new_status: dbStatus, changed_by: userId });
  return { ok: true as const };
}
