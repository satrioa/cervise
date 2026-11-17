"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import type { InventoryProduct } from "@/lib/operational/inventori";
import {
  buildProductSnapshot,
  buildSparepartSnapshot,
  OPNAME_POSTER_ROLES,
  type OpnameLineDraft,
  type OpnameSparepart,
} from "@/lib/operational/stock-opname";

const PRODUCT_COLUMNS =
  "id, name, sku, category, stock_qty, cost, price, variant_type, imei, parent_key";

type Domain = "product" | "sparepart";
type SessionStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type OpnameSession = {
  id: string;
  domain: Domain;
  status: SessionStatus;
  note: string | null;
  started_at: string;
  posted_at: string | null;
  lineCount?: number;
};

export type OpnameLine = {
  id: string;
  ref_id: string;
  sku: string | null;
  name: string | null;
  imei: string | null;
  snapshot_qty: number;
  counted_qty: number;
  unit_cost: number;
  notes: string | null;
};

async function actor() {
  const a = await getActiveTenant();
  if (!a.branchId) throw new Error("Pilih cabang dulu sebelum stock opname");
  return a;
}

async function poster() {
  const a = await actor();
  if (!OPNAME_POSTER_ROLES.includes(a.role)) {
    throw new Error("Role ini tidak boleh memposting opname");
  }
  return a;
}

async function manager() {
  const a = await actor();
  if (!["MASTER_ADMIN", "ADMIN"].includes(a.role)) {
    throw new Error("Hanya admin yang boleh membatalkan opname");
  }
  return a;
}

export async function listSessions(domain: Domain): Promise<OpnameSession[]> {
  const a = await actor();
  const { data, error } = await a.supabase
    .from("cervise_stock_opname_sessions")
    .select("id, domain, status, note, started_at, posted_at")
    .eq("organization_id", a.orgId)
    .eq("branch_id", a.branchId!)
    .eq("domain", domain)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as OpnameSession[];
}

export async function getSession(
  id: string,
): Promise<{ session: OpnameSession; lines: OpnameLine[] }> {
  const a = await actor();
  const { data: session, error: sessionError } = await a.supabase
    .from("cervise_stock_opname_sessions")
    .select("id, domain, status, note, started_at, posted_at")
    .eq("id", id)
    .eq("branch_id", a.branchId!)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Sesi tidak ditemukan");

  const { data: lines, error: linesError } = await a.supabase
    .from("cervise_stock_opname_lines")
    .select("id, ref_id, sku, name, imei, snapshot_qty, counted_qty, unit_cost, notes")
    .eq("session_id", id)
    .order("name");
  if (linesError) throw new Error(linesError.message);

  return { session: session as OpnameSession, lines: (lines ?? []) as OpnameLine[] };
}

export async function createSession(domain: Domain, note: string): Promise<string> {
  const a = await actor();
  let lines: OpnameLineDraft[];

  if (domain === "product") {
    const { data, error } = await a.supabase
      .from("cervise_products")
      .select(PRODUCT_COLUMNS)
      .eq("organization_id", a.orgId)
      .eq("branch_id", a.branchId!);
    if (error) throw new Error(error.message);
    lines = buildProductSnapshot((data ?? []) as InventoryProduct[]);
  } else {
    const { data, error } = await a.supabase
      .from("cervise_spareparts")
      .select("id, sku, name, stock_qty, cost")
      .eq("organization_id", a.orgId)
      .eq("branch_id", a.branchId!);
    if (error) throw new Error(error.message);
    lines = buildSparepartSnapshot((data ?? []) as OpnameSparepart[]);
  }

  if (lines.length === 0) throw new Error("Tidak ada barang untuk dihitung di cabang ini");

  const { data: session, error: sessionError } = await a.supabase
    .from("cervise_stock_opname_sessions")
    .insert({
      organization_id: a.orgId,
      branch_id: a.branchId!,
      domain,
      note: note.trim() || null,
      created_by: a.userId,
    })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { error: linesError } = await a.supabase
    .from("cervise_stock_opname_lines")
    .insert(
      lines.map((line) => ({
        session_id: session.id,
        organization_id: a.orgId,
        branch_id: a.branchId!,
        ref_id: line.refId,
        sku: line.sku,
        name: line.name,
        imei: line.imei,
        snapshot_qty: line.snapshotQty,
        counted_qty: 0,
        unit_cost: Math.round(line.cost),
      })),
    );
  if (linesError) throw new Error(linesError.message);

  revalidatePath("/app/inventori/opname");
  return session.id as string;
}

export async function saveCount(
  sessionId: string,
  refId: string,
  imei: string | null,
  countedQty: number,
): Promise<void> {
  const a = await actor();
  if (!Number.isInteger(countedQty) || countedQty < 0) {
    throw new Error("Jumlah fisik harus bilangan bulat >= 0");
  }

  const { data: session, error: sessionError } = await a.supabase
    .from("cervise_stock_opname_sessions")
    .select("status")
    .eq("id", sessionId)
    .eq("branch_id", a.branchId!)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status !== "DRAFT") throw new Error("Sesi tidak bisa diubah lagi");

  let query = a.supabase
    .from("cervise_stock_opname_lines")
    .update({
      counted_qty: countedQty,
      counted_by: a.userId,
      counted_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("ref_id", refId);
  query = imei ? query.eq("imei", imei) : query.is("imei", null);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function postSession(id: string): Promise<void> {
  await poster();
  const a = await actor();
  const { error } = await a.supabase.rpc("post_stock_opname", { p_session_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/app/inventori/opname");
  revalidatePath(`/app/inventori/opname/${id}`);
}

export async function cancelSession(id: string): Promise<void> {
  const a = await manager();
  const { error } = await a.supabase
    .from("cervise_stock_opname_sessions")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .eq("branch_id", a.branchId!)
    .eq("status", "DRAFT");
  if (error) throw new Error(error.message);
  revalidatePath("/app/inventori/opname");
  revalidatePath(`/app/inventori/opname/${id}`);
}
