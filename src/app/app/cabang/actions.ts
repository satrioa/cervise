"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getOrg() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: emp } = await supabase.from("employees").select("organization_id").eq("profile_id", auth.user.id).limit(1).maybeSingle();
  if (!emp?.organization_id) {
    const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
    if (!org?.id) throw new Error("Organization not found");
    return { supabase, orgId: org.id as string, userId: auth.user.id };
  }
  return { supabase, orgId: emp.organization_id as string, userId: auth.user.id };
}

export async function getCabangList() {
  const { supabase, orgId } = await getOrg();
  const { data: branches, error } = await supabase.from("branches").select("id,name,city,phone,is_active,created_at").eq("organization_id", orgId).order("created_at");
  if (error) throw new Error(error.message);
  const ids = (branches ?? []).map((b: any) => b.id);
  let counts = new Map<string, number>();
  if (ids.length) {
    const { data: emps } = await supabase.from("employees").select("branch_id").eq("organization_id", orgId).eq("is_active", true).in("branch_id", ids);
    for (const e of (emps ?? []) as any[]) {
      if (!e.branch_id) continue;
      counts.set(e.branch_id, (counts.get(e.branch_id) ?? 0) + 1);
    }
  }
  return (branches ?? []).map((b: any) => ({
    id: b.id as string,
    name: b.name as string,
    city: (b.city as string | null) ?? "",
    phone: (b.phone as string | null) ?? "",
    is_active: !!b.is_active,
    created_at: b.created_at as string,
    teknisiCount: counts.get(b.id as string) ?? 0,
  }));
}

export async function createCabang(form: { name: string; alamat: string; telepon: string }) {
  const { supabase, orgId } = await getOrg();
  const name = form.name.trim();
  if (!name) throw new Error("Nama cabang wajib");
  if (name.length > 50) throw new Error("Nama maksimal 50 karakter");
  const { error } = await supabase.from("branches").insert({
    organization_id: orgId,
    name,
    city: form.alamat.trim() || null,
    phone: form.telepon.trim() || null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function toggleCabangActive(id: string, enabled: boolean) {
  const { supabase, orgId } = await getOrg();
  const { error } = await supabase.from("branches").update({ is_active: enabled }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function getCabangMembers(branchId: string) {
  const { supabase, orgId } = await getOrg();
  const { data: emps, error } = await supabase
    .from("employees")
    .select("id, profile_id, role, is_active, created_at")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  const pIds = (emps ?? []).map((e: any) => e.profile_id).filter(Boolean);
  let profiles = new Map<string, { full_name: string | null; email: string | null }>();
  if (pIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", pIds);
    for (const p of (profs ?? []) as any[]) profiles.set(p.id, { full_name: p.full_name, email: p.email });
  }
  const statuses: Array<"online" | "away" | "off"> = ["online", "away", "off"];
  const roleLabel: Record<string, string> = { TECHNICIAN: "Teknisi", ADMIN: "Admin", FRONTLINER: "Frontliner", MASTER_ADMIN: "Master Admin" };
  return (emps ?? []).map((e: any, idx: number) => {
    const prof = profiles.get(e.profile_id);
    const name = prof?.full_name ?? `User ${String(e.id).slice(0, 4)}`;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join("") || "U";
    const email = prof?.email ?? `${e.profile_id.slice(0, 8)}@cabang.local`;
    const isActive = !!e.is_active;
    const status = !isActive ? "off" : statuses[idx % statuses.length];
    const role = roleLabel[e.role] ?? e.role;
    return {
      id: e.id as string,
      name,
      initials,
      email,
      role,
      status: status as "online" | "away" | "off",
      customStatus: idx % 2 === 0 ? (status === "online" ? "🛠 Sedang servis" : status === "away" ? "Idle" : undefined) : undefined,
      active: isActive ? (status === "online" ? "active now" : status === "away" ? "idle" : "tidak aktif") : "tidak aktif",
      permission: (e.role === "ADMIN" || e.role === "MASTER_ADMIN" ? "Admin" : e.role === "TECHNICIAN" ? "Member" : "Viewer") as "Owner" | "Admin" | "Member" | "Viewer",
    };
  });
}

export async function updateCabang(id: string, form: { name: string; alamat: string; telepon: string }) {
  const { supabase, orgId } = await getOrg();
  const name = form.name.trim();
  if (!name) throw new Error("Nama cabang wajib");
  if (name.length > 50) throw new Error("Nama maksimal 50 karakter");
  const { error } = await supabase.from("branches").update({ name, city: form.alamat.trim() || null, phone: form.telepon.trim() || null }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}
