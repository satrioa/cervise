"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccessActor } from "@/lib/rbac";
import { normalizeAppRole } from "@/lib/nav/manifest";
import { validWorkHours } from "./work-hours";

function requireCabangAccess(actor: { role: string; permissions?: readonly string[] | null }) {
  if (!canAccessActor(actor, "cabang")) throw new Error("Role tidak diizinkan mengelola cabang");
}

type IntensifMode = "percent" | "fixed" | "flat";

/**
 * Baca `intensif_mode` tanpa cast.
 *
 * Sebelumnya di sini ada `as "percent" | "fixed"` -- union yang TIDAK menyertakan
 * `"flat"`. Cast itu membuat compiler satisfied padahal nilai `"flat"` ikut
 * diteruskan, dan `branch-cards.tsx` yang punya union sama ikut kelewatan
 * menampilkan bonus flat seolah-olah nominal per servis.
 *
 * Sekarang nilainya benar-benar diperiksa, dan nilai asing (mis. data lama
 * sebelum constraint) turun ke `"percent"` alih-alih disebut apa adanya.
 */
function readIntensifMode(value: unknown): IntensifMode {
  return value === "fixed" || value === "flat" || value === "percent" ? value : "percent";
}

export async function getCabangList() {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const { data: branches, error } = await supabase.from("branches").select("id,name,city,phone,is_active,is_intensif_enabled,intensif_mode,intensif_value,intensif_target_count,target_type,target_value,show_target_to_teknisi,show_intensif_to_teknisi,check_in_time,check_out_time,created_at").eq("organization_id", orgId).order("created_at");
  if (error) throw new Error(error.message);
  const ids = (branches ?? []).map((b: any) => b.id);
  let counts = new Map<string, number>();
  if (ids.length) {
    const { data: emps } = await supabase.from("employees").select("branch_id, role").eq("organization_id", orgId).eq("is_active", true).in("branch_id", ids);
    for (const e of (emps ?? []) as any[]) {
      if (!e.branch_id || normalizeAppRole(e.role) !== "TECHNICIAN") continue;
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
    intensif_mode: readIntensifMode(b.intensif_mode),
    intensif_value: b.intensif_value ?? 5,
    intensif_target_count: b.intensif_target_count ?? null,
    target_type: b.target_type === "penghasilan" ? "penghasilan" : "jumlah_servis",
    target_value: b.target_value ?? null,
    show_target_to_teknisi: b.show_target_to_teknisi ?? true,
    show_intensif_to_teknisi: b.show_intensif_to_teknisi ?? true,
    check_in_time: (b.check_in_time as string) ?? "08:00",
    check_out_time: (b.check_out_time as string) ?? "17:00",
    created_at: b.created_at as string,
    teknisiCount: counts.get(b.id as string) ?? 0,
  }));
}

export async function createCabang(form: { name: string; alamat: string; telepon: string }) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
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
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const { error } = await supabase.from("branches").update({ is_active: enabled }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function toggleCabangIntensif(id: string, enabled: boolean) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const { error } = await supabase.from("branches").update({ is_intensif_enabled: enabled }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangIntensif(
  id: string,
  data: { mode: "percent" | "fixed" | "flat"; value: number; targetCount: number | null }
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  if (!["percent", "fixed", "flat"].includes(data.mode)) throw new Error("Mode invalid");
  if (data.value === null || isNaN(data.value) || data.value < 0) throw new Error("Nilai insentif harus >=0");
  if (data.targetCount !== null && (isNaN(data.targetCount) || data.targetCount <= 0)) throw new Error("Target harus >0");
  // Mode flat tidak pernah membayar tanpa target, jadi menyimpan target kosong
  // di mode itu hanya menghasilkan bonus nol yang tidak disadari.
  if (data.mode === "flat" && data.targetCount === null) {
    throw new Error("Mode Flat bulanan wajib punya target per teknisi");
  }
  // Target hanya bermakna di mode flat. Mode lain dipaksa null di sini, bukan
  // hanya disembunyikan di form: kalau tidak, request basi atau sengaja dibuat
  // akan meninggalkan target yang diam-diam menggerakkan KPI "Target" dan
  // progress bar di dashboard.
  const targetCount = data.mode === "flat" ? data.targetCount : null;
  const { error } = await supabase
    .from("branches")
    .update({ intensif_mode: data.mode, intensif_value: data.value, intensif_target_count: targetCount })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangTarget(
  id: string,
  data: { type: "penghasilan" | "jumlah_servis"; value: number | null }
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  if (data.type !== "penghasilan" && data.type !== "jumlah_servis") throw new Error("Tipe target invalid");
  if (data.value !== null && (!Number.isInteger(data.value) || data.value <= 0)) {
    throw new Error("Nilai target harus > 0");
  }
  const { error } = await supabase
    .from("branches")
    .update({ target_type: data.type, target_value: data.value })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangCardVisibility(
  id: string,
  data: { showTarget: boolean; showIntensif: boolean }
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const { error } = await supabase
    .from("branches")
    .update({
      show_target_to_teknisi: data.showTarget,
      show_intensif_to_teknisi: data.showIntensif,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function getCabangMembers(branchId: string) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
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
      customStatus: idx % 2 === 0 ? (status === "online" ? "Ã°Å¸â€ºÂ  Sedang servis" : status === "away" ? "Idle" : undefined) : undefined,
      active: isActive ? (status === "online" ? "active now" : status === "away" ? "idle" : "tidak aktif") : "tidak aktif",
      permission: (e.role === "ADMIN" || e.role === "MASTER_ADMIN" ? "Admin" : e.role === "TECHNICIAN" ? "Member" : "Viewer") as "Owner" | "Admin" | "Member" | "Viewer",
    };
  });
}

export async function updateCabang(id: string, form: { name: string; alamat: string; telepon: string }) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const name = form.name.trim();
  if (!name) throw new Error("Nama cabang wajib");
  if (name.length > 50) throw new Error("Nama maksimal 50 karakter");
  const { error } = await supabase.from("branches").update({ name, city: form.alamat.trim() || null, phone: form.telepon.trim() || null }).eq("id", id).eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangWorkHours(
  id: string,
  data: { checkInTime: string; checkOutTime: string },
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  if (!validWorkHours(data.checkInTime, data.checkOutTime)) {
    throw new Error("Jam masuk harus lebih awal dari jam pulang (HH:MM)");
  }
  const { error } = await supabase
    .from("branches")
    .update({ check_in_time: data.checkInTime, check_out_time: data.checkOutTime })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}
