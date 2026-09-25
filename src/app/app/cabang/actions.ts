"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";

export async function getCabangList() {
  const { supabase, orgId } = await getActiveTenant();
  const { data: branches, error } = await supabase.from("branches").select("id,name,city,phone,is_active,is_intensif_enabled,intensif_mode,intensif_value,intensif_target_count,created_at").eq("organization_id", orgId).order("created_at");
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
    is_intensif_enabled: b.is_intensif_enabled ?? true,
    intensif_mode: (b.intensif_mode as "percent" | "fixed") ?? "percent",
    intensif_value: b.intensif_value ?? 5,
    intensif_target_count: b.intensif_target_count ?? null,
    created_at: b.created_at as string,
    teknisiCount: counts.get(b.id as string) ?? 0,
  }));
}

export async function createCabang(form: { name: string; alamat: string; telepon: string }) {
  const { supabase, orgId } = await getActiveTenant();
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
  const { supabase, orgId } = await getActiveTenant();
  const { error } = await supabase.from("branches").update({ is_active: enabled }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function toggleCabangIntensif(id: string, enabled: boolean) {
  const { supabase, orgId } = await getActiveTenant();
  const { error } = await supabase.from("branches").update({ is_intensif_enabled: enabled }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangIntensif(
  id: string,
  data: { mode: "percent" | "fixed"; value: number; targetCount: number | null }
) {
  const { supabase, orgId } = await getActiveTenant();
  if (!["percent", "fixed"].includes(data.mode)) throw new Error("Mode invalid");
  if (data.value === null || isNaN(data.value) || data.value < 0) throw new Error("Nilai intensif harus >=0");
  if (data.targetCount !== null && (isNaN(data.targetCount) || data.targetCount <= 0)) throw new Error("Target harus >0");
  const { error } = await supabase
    .from("branches")
    .update({ intensif_mode: data.mode, intensif_value: data.value, intensif_target_count: data.targetCount })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function getCabangMembers(branchId: string) {
  const { supabase, orgId } = await getActiveTenant();
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
  const { supabase, orgId } = await getActiveTenant();
  const name = form.name.trim();
  if (!name) throw new Error("Nama cabang wajib");
  if (name.length > 50) throw new Error("Nama maksimal 50 karakter");
  const { error } = await supabase.from("branches").update({ name, city: form.alamat.trim() || null, phone: form.telepon.trim() || null }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}
