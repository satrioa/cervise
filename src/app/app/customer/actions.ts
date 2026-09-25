"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";

function normalizePhone62(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw new Error("Telepon wajib");
  let norm = digits;
  if (norm.startsWith("0")) norm = "62" + norm.slice(1);
  else if (norm.startsWith("62")) norm = norm;
  else if (norm.length >= 9 && norm.length <= 12) norm = "62" + norm;
  else throw new Error("Telepon harus diawali 62 atau 08");
  if (!/^62\d{8,13}$/.test(norm)) throw new Error("Telepon harus 62 + 8-13 digit (contoh 62812xxxxxxx)");
  return norm;
}

function formatPhoneDisplay(norm62: string): string {
  if (!norm62.startsWith("62")) return norm62;
  const local = "0" + norm62.slice(2);
  if (local.length <= 10) return local.replace(/(\d{4})(\d{4})(\d+)/, "$1 $2 $3").trim();
  return local.replace(/(\d{4})(\d{4})(\d+)/, "$1 $2 $3").trim();
}

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string;
  phoneDisplay: string;
  createdAt: string;
  createdAtRaw: string;
  totalServis: number;
  totalSpent: number;
  lastServis: string;
  lastStatus: string;
  lastDate: string;
  lastDateRaw: string | null;
};

export async function getCustomers(): Promise<CustomerListRow[]> {
  const { supabase, orgId, branchId } = await getActiveTenant();
  if (!branchId) throw new Error("Branch not set for tenant");
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, created_at")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const list = (customers ?? []) as any[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const { data: orders } = await supabase
    .from("repair_orders")
    .select("id, customer_id, status, created_at, subtotal_cents")
    .eq("organization_id", orgId)
    .in("customer_id", ids)
    .order("created_at", { ascending: false });

  const orderByCustomer = new Map<string, any[]>();
  for (const o of (orders ?? []) as any[]) {
    if (!orderByCustomer.has(o.customer_id)) orderByCustomer.set(o.customer_id, []);
    orderByCustomer.get(o.customer_id)!.push(o);
  }

  const statusLabel: Record<string, string> = {
    received: "Masuk",
    diagnosed: "Diagnosa",
    waiting_approval: "Menunggu Konfirmasi",
    waiting_part: "Menunggu Sparepart",
    in_repair: "Dikerjakan",
    quality_control: "Selesai",
    ready: "Selesai",
    picked_up: "Sudah Diambil",
    cancelled: "Batal",
  };

  return list.map((c) => {
    const ords = orderByCustomer.get(c.id) ?? [];
    const totalServis = ords.length;
    const totalSpent = ords.reduce((a: number, o: any) => a + Number(o.subtotal_cents ?? 0) / 100, 0);
    const last = ords[0] as any | undefined;
    const lastServis = last ? String(last.id).slice(0, 8).toUpperCase() : "—";
    const lastStatus = last ? statusLabel[last.status] ?? last.status : "—";
    const lastDateRaw = last?.created_at ?? null;
    const lastDate = lastDateRaw ? new Date(lastDateRaw).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const createdAtRaw = c.created_at as string;
    const createdAt = new Date(createdAtRaw).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const norm = c.phone ? String(c.phone).replace(/\D/g, "") : "";
    let phoneNorm = norm;
    if (phoneNorm.startsWith("0")) phoneNorm = "62" + phoneNorm.slice(1);
    const phoneDisplay = phoneNorm ? formatPhoneDisplay(phoneNorm) : "—";
    return {
      id: c.id as string,
      name: c.name as string,
      phone: phoneNorm,
      phoneDisplay,
      createdAt,
      createdAtRaw,
      totalServis,
      totalSpent: Math.round(totalSpent),
      lastServis,
      lastStatus,
      lastDate,
      lastDateRaw,
    };
  });
}

export async function createCustomer(form: { name: string; phone: string }) {
  const { supabase, orgId, branchId } = await getActiveTenant();
  if (!branchId) throw new Error("Branch not set");
  const name = form.name.trim();
  if (!name) throw new Error("Nama wajib");
  if (name.length < 2) throw new Error("Nama minimal 2 karakter");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");
  const norm = normalizePhone62(form.phone);
  const { data: dup } = await supabase.from("customers").select("id").eq("organization_id", orgId).eq("branch_id", branchId).eq("phone", norm).maybeSingle();
  if (dup?.id) throw new Error("HP sudah terdaftar di cabang ini");
  const { error } = await supabase.from("customers").insert({ organization_id: orgId, branch_id: branchId, name, phone: norm });
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export async function updateCustomer(id: string, form: { name: string; phone: string }) {
  const { supabase, orgId, branchId } = await getActiveTenant();
  if (!branchId) throw new Error("Branch not set");
  if (!id) throw new Error("ID wajib");
  const name = form.name.trim();
  if (!name) throw new Error("Nama wajib");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");
  const norm = normalizePhone62(form.phone);
  const { data: dup } = await supabase.from("customers").select("id").eq("organization_id", orgId).eq("branch_id", branchId).eq("phone", norm).neq("id", id).maybeSingle();
  if (dup?.id) throw new Error("HP sudah terdaftar di cabang ini");
  const { error } = await supabase.from("customers").update({ name, phone: norm }).eq("id", id).eq("organization_id", orgId).eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export async function deleteCustomer(id: string) {
  const { supabase, orgId, branchId } = await getActiveTenant();
  if (!branchId) throw new Error("Branch not set");
  if (!id) throw new Error("ID wajib");
  const { count, error: cntErr } = await supabase.from("repair_orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("customer_id", id);
  if (cntErr) throw new Error(cntErr.message);
  if ((count ?? 0) > 0) throw new Error("Customer punya servis, tidak bisa dihapus");
  const { error } = await supabase.from("customers").delete().eq("id", id).eq("organization_id", orgId).eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export type CustomerServisRow = {
  id: string;
  problem: string;
  status: string;
  created_at: string;
  subtotal_cents: number;
};

export async function getCustomerServis(customerId: string): Promise<CustomerServisRow[]> {
  const { supabase, orgId } = await getActiveTenant();
  const { data, error } = await supabase
    .from("repair_orders")
    .select("id, problem, status, created_at, subtotal_cents")
    .eq("organization_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: String(r.id).slice(0, 8).toUpperCase(),
    problem: r.problem as string,
    status: r.status as string,
    created_at: new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    subtotal_cents: Number(r.subtotal_cents ?? 0),
  }));
}
export async function searchCustomersByPhone(q: string) {
  const { supabase, orgId, branchId } = await getActiveTenant();
  if (!branchId) throw new Error("Branch not set");
  const term = q.trim().replace(/\D/g, "");
  if (term.length < 3) return [];
  const { data, error } = await supabase.from("customers").select("id, name, phone").eq("organization_id", orgId).eq("branch_id", branchId).ilike("phone", `%${term}%`).limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => {
    const norm = String(r.phone ?? "").replace(/\D/g, "");
    let phoneNorm = norm;
    if (phoneNorm.startsWith("0")) phoneNorm = "62" + phoneNorm.slice(1);
    return { id: r.id as string, name: r.name as string, phone: phoneNorm, phoneDisplay: formatPhoneDisplay(phoneNorm) };
  });
}
