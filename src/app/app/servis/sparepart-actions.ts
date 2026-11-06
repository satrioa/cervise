"use server";

import { revalidatePath } from "next/cache";
import { servisBill, servisOutstanding } from "@/lib/operational/servis-price";
import { getActiveTenant } from "@/lib/supabase/actor";
import { sanitizeSearchTerm } from "@/lib/search-term";

export type SparepartStockRow = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
};

export type SparepartUsageInput = {
  sparepart_id: string;
  qty: number;
};

export type ServisSparepartRow = {
  id: string;
  product_id: string | null;
  sparepart_id: string | null;
  sku: string;
  name: string;
  category: string | null;
  qty: number;
  unit_price: number;
  cost: number;
  line_total: number;
  is_returned: boolean;
  returned_at: string | null;
  created_at: string;
};

type ServiceSparepartDbRow = {
  id: string;
  product_id: string | null;
  sparepart_id: string | null;
  sku: string | null;
  name: string;
  category: string | null;
  qty: number;
  unit_price: number;
  cost: number;
  line_total: number;
  is_returned: boolean;
  returned_at: string | null;
  created_at: string;
};

type Actor = Awaited<ReturnType<typeof getActiveTenant>>;

type SparepartDbRow = {
  id: string;
  sku: string | null;
  name: string;
  stock_qty: number | null;
  cost: number | null;
  price: number | null;
};

async function getActor(): Promise<Actor> {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  return actor;
}

function requireText(value: string, label: string, min = 3) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < min) throw new Error(`${label} wajib diisi minimal ${min} karakter`);
  return trimmed;
}

function normalizeUsage(items: SparepartUsageInput[]): SparepartUsageInput[] {
  if (!items || items.length === 0) throw new Error("Pilih minimal 1 sparepart");
  return items.map((item) => {
    if (!item?.sparepart_id) throw new Error("Sparepart tidak valid");
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error("Qty harus bilangan bulat > 0");
    return { sparepart_id: item.sparepart_id, qty };
  });
}

async function callRpc<T>(actor: Actor, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await actor.supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return (data ?? null) as T;
}

export async function searchSparepartStock(q: string): Promise<SparepartStockRow[]> {
  const actor = await getActor();
  const term = sanitizeSearchTerm(q);

  let query = actor.supabase
    .from("cervise_spareparts")
    .select("id, sku, name, stock_qty, cost, price")
    .eq("branch_id", actor.branchId)
    .eq("is_active", true);

  if (term) {
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const { data, error } = await query.order("name").limit(50);
  if (error) throw new Error(error.message);

  return ((data ?? []) as SparepartDbRow[]).map((row) => ({
    id: row.id,
    sku: row.sku ?? "",
    name: row.name,
    qty: Number(row.stock_qty ?? 0),
    price: Number(row.price ?? 0),
    cost: Number(row.cost ?? 0),
  }));
}

export async function getServisSpareparts(servisId: string): Promise<ServisSparepartRow[]> {
  if (!servisId) return [];
  const actor = await getActor();

  const { data, error } = await actor.supabase
    .from("cervise_service_spareparts")
    .select("id, product_id, sparepart_id, sku, name, category, qty, unit_price, cost, line_total, is_returned, returned_at, created_at")
    .eq("servis_id", servisId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as ServiceSparepartDbRow[]).map((row) => ({
    id: row.id,
    product_id: row.product_id ?? null,
    sparepart_id: row.sparepart_id ?? null,
    sku: row.sku ?? "",
    name: row.name,
    category: row.category ?? null,
    qty: Number(row.qty ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    cost: Number(row.cost ?? 0),
    line_total: Number(row.line_total ?? 0),
    is_returned: Boolean(row.is_returned),
    returned_at: row.returned_at ?? null,
    created_at: row.created_at,
  }));
}

export async function useSparepartsForServis(servisId: string, items: SparepartUsageInput[]) {
  if (!servisId) throw new Error("Servis wajib");
  const actor = await getActor();
  const payload = normalizeUsage(items);

  await callRpc(actor, "consume_service_spareparts", {
    p_servis_id: servisId,
    p_items: payload,
    p_set_status: true,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}

export async function addSparepartsToServis(servisId: string, items: SparepartUsageInput[]) {
  if (!servisId) throw new Error("Servis wajib");
  const actor = await getActor();
  const payload = normalizeUsage(items);

  await callRpc(actor, "consume_service_spareparts", {
    p_servis_id: servisId,
    p_items: payload,
    p_set_status: false,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}

export async function removeServisSparepart(sparepartId: string, reason: string) {
  if (!sparepartId) throw new Error("Sparepart wajib");
  const actor = await getActor();
  const note = requireText(reason, "Alasan");

  await callRpc(actor, "return_service_sparepart", {
    p_sparepart_id: sparepartId,
    p_reason: note,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}

export async function cancelServisWithSpareparts(
  servisId: string,
  decision: "return" | "keep_consumed",
  reason: string,
) {
  if (!servisId) throw new Error("Servis wajib");
  const actor = await getActor();
  const note = requireText(reason, "Alasan");

  if (decision === "return") {
    await callRpc(actor, "return_service_spareparts", { p_servis_id: servisId, p_reason: note });
  } else {
    await callRpc(actor, "mark_service_spareparts_kept", { p_servis_id: servisId, p_reason: note });
  }

  await callRpc(actor, "set_service_status", {
    p_servis_id: servisId,
    p_status: "Batal",
    p_note: note,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}

/**
 * Servis hanya boleh diambil setelah lunas.
 *
 * `set_service_picked_up` dan `set_service_status` di database tidak memeriksa
 * pembayaran, jadi guard-nya di sini. Sisa tagihan dihitung dari ledger kas
 * (`finance_tx`), bukan dari `cervise_services.price`, karena kolom itu berisi
 * total yang SUDAH dibayar.
 */
async function assertServisLunas(actor: Actor, servisId: string): Promise<void> {
  const branchId = actor.branchId;
  if (!branchId) throw new Error("Branch not set for tenant");

  const { data: service, error } = await actor.supabase
    .from("cervise_services")
    .select("price, price_estimasi")
    .eq("id", servisId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!service) throw new Error("Servis tidak ditemukan");

  const { data: payments, error: paymentError } = await actor.supabase
    .from("finance_tx")
    .select("amount")
    .eq("branch_id", branchId)
    .eq("servis_id", servisId)
    .eq("type", "pemasukan");
  if (paymentError) throw new Error(paymentError.message);

  const paid = (payments ?? []).reduce((total, row) => total + Number(row.amount ?? 0), 0);
  const bill = servisBill(service.price as number | null, service.price_estimasi as number | null);
  if (servisOutstanding(bill, paid) > 0) {
    throw new Error("Servis belum lunas. Selesaikan pembayaran dulu sebelum pengambilan.");
  }
}

export async function confirmServisPickup(servisId: string, signature: string, note?: string | null) {
  if (!servisId) throw new Error("Servis wajib");
  const actor = await getActor();
  const svg = signature?.trim() ?? "";
  if (!svg.startsWith("<svg")) throw new Error("Tanda tangan wajib");
  await assertServisLunas(actor, servisId);

  await callRpc(actor, "set_service_picked_up", {
    p_servis_id: servisId,
    p_signature: svg,
    p_note: note?.trim() ? note.trim() : null,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}

export async function updateServisStatus(servisId: string, nextStatus: string, note?: string | null) {
  if (!servisId) throw new Error("Servis wajib");
  const actor = await getActor();
  if (!nextStatus?.trim()) throw new Error("Status wajib");
  if (nextStatus.trim() === "picked_up" || nextStatus.trim() === "Sudah Diambil") {
    await assertServisLunas(actor, servisId);
  }

  await callRpc(actor, "set_service_status", {
    p_servis_id: servisId,
    p_status: nextStatus.trim(),
    p_note: note?.trim() ? note.trim() : null,
  });

  revalidatePath("/app/servis");
  return { ok: true };
}
