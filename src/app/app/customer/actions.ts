"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";
import {
  mapCustomerRows,
  type CustomerInput,
  type CustomerListRow,
  type CustomerServiceInput,
} from "@/lib/operational/customer-list";

export type { CustomerListRow };

function requireCustomerAccess(role: string) {
  if (!canAccess(role, "customer")) throw new Error("Role tidak diizinkan mengakses customer");
}

// Strict validator for the write paths; the mapper has its own lenient version
// for display, because stored data can predate these rules.
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

export async function getCustomers(): Promise<CustomerListRow[]> {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set for tenant");
  const { data: customers, error } = await supabase
    .from("cervise_customers")
    .select("id, name, phone, created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const list = (customers ?? []) as CustomerInput[];
  if (list.length === 0) return [];

  const { data: services, error: servicesError } = await supabase
    .from("cervise_services")
    .select("id, service_number, customer_id, status, created_at, price")
    .eq("branch_id", branchId)
    .in(
      "customer_id",
      list.map((customer) => customer.id),
    );
  if (servicesError) throw new Error(servicesError.message);

  return mapCustomerRows({ customers: list, services: (services ?? []) as CustomerServiceInput[] });
}

/** Same data, but returns the error instead of throwing so pages can render it. */
export async function getCustomersSafe(): Promise<{
  data: CustomerListRow[];
  error: { message: string } | null;
}> {
  try {
    return { data: await getCustomers(), error: null };
  } catch (cause) {
    return {
      data: [],
      error: { message: cause instanceof Error ? cause.message : "Gagal memuat data customer" },
    };
  }
}

export async function createCustomer(form: { name: string; phone: string }) {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  const name = form.name.trim();
  if (!name) throw new Error("Nama wajib");
  if (name.length < 2) throw new Error("Nama minimal 2 karakter");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");
  const norm = normalizePhone62(form.phone);
  const { data: dup } = await supabase.from("cervise_customers").select("id").eq("branch_id", branchId).eq("phone", norm).maybeSingle();
  if (dup?.id) throw new Error("HP sudah terdaftar di cabang ini");
  const { error } = await supabase.from("cervise_customers").insert({ branch_id: branchId, name, phone: norm, tags: [] });
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export async function updateCustomer(id: string, form: { name: string; phone: string }) {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  if (!id) throw new Error("ID wajib");
  const name = form.name.trim();
  if (!name) throw new Error("Nama wajib");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");
  const norm = normalizePhone62(form.phone);
  const { data: dup } = await supabase.from("cervise_customers").select("id").eq("branch_id", branchId).eq("phone", norm).neq("id", id).maybeSingle();
  if (dup?.id) throw new Error("HP sudah terdaftar di cabang ini");
  const { error } = await supabase.from("cervise_customers").update({ name, phone: norm }).eq("id", id).eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export async function deleteCustomer(id: string) {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  if (!id) throw new Error("ID wajib");
  const { count, error: cntErr } = await supabase.from("cervise_services").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("customer_id", id);
  if (cntErr) throw new Error(cntErr.message);
  if ((count ?? 0) > 0) throw new Error("Customer punya servis, tidak bisa dihapus");
  const { error } = await supabase.from("cervise_customers").delete().eq("id", id).eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/customer");
  return { ok: true };
}

export type CustomerServisRow = {
  id: string;
  problem: string;
  status: string;
  created_at: string;
  total: number;
};

export async function getCustomerServis(customerId: string): Promise<CustomerServisRow[]> {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  const { data, error } = await supabase
    .from("cervise_services")
    .select("id, complaint, device, status, created_at, price")
    .eq("branch_id", branchId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: String(r.id).slice(0, 8).toUpperCase(),
    problem: (r.complaint ?? r.device ?? "") as string,
    status: r.status as string,
    created_at: new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    total: Number(r.price ?? 0),
  }));
}
export async function searchCustomersByPhone(q: string) {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  const term = q.trim().replace(/\D/g, "");
  if (term.length < 3) return [];
  const { data, error } = await supabase.from("cervise_customers").select("id, name, phone").eq("branch_id", branchId).ilike("phone", `%${term}%`).limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => {
    const norm = String(r.phone ?? "").replace(/\D/g, "");
    let phoneNorm = norm;
    if (phoneNorm.startsWith("0")) phoneNorm = "62" + phoneNorm.slice(1);
    return { id: r.id as string, name: r.name as string, phone: phoneNorm, phoneDisplay: formatPhoneDisplay(phoneNorm) };
  });
}

export async function findOrCreateCustomer(input: { phone: string; name?: string }) {
  const { supabase, branchId, role } = await getActiveTenant();
  requireCustomerAccess(role);
  if (!branchId) throw new Error("Branch not set");
  const norm = normalizePhone62(input.phone);
  const name = (input.name ?? "").trim() || norm;

  const { data: existing } = await supabase
    .from("cervise_customers")
    .select("id, name")
    .eq("branch_id", branchId)
    .eq("phone", norm)
    .maybeSingle();
  if (existing) return { id: existing.id as string, name: existing.name as string, created: false };

  const { data, error } = await supabase
    .from("cervise_customers")
    .insert({ branch_id: branchId, name, phone: norm, tags: ["sales"] })
    .select("id, name")
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from("cervise_customers")
      .select("id, name")
      .eq("branch_id", branchId)
      .eq("phone", norm)
      .maybeSingle();
    if (retry) return { id: retry.id as string, name: retry.name as string, created: false };
    throw new Error(error.message);
  }

  return { id: data.id as string, name: data.name as string, created: true };
}
