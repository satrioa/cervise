"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";

export async function updateBranchBrand(input: { branchId: string; name: string }) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_general")) {
    throw new Error("Role tidak diizinkan mengubah pengaturan cabang");
  }
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new Error("Nama brand harus 2-80 karakter");

  const { data, error } = await actor.supabase
    .from("branches")
    .update({ name })
    .eq("id", input.branchId)
    .eq("organization_id", actor.orgId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cabang tidak ditemukan");

  revalidatePath("/app/pengaturan");
  return { ok: true };
}

export async function getBranchBrand(branchId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "dashboard")) throw new Error("Role tidak diizinkan");

  const { data, error } = await actor.supabase
    .from("branches")
    .select("id, name, logo_url")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getMasterAdmins(branchId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_general")) {
    throw new Error("Role tidak diizinkan melihat daftar admin");
  }

  // employees.role adalah sumber otoritas (uppercase). profiles.role hanya field
  // legacy lowercase, jadi jangan difilter dari sana.
  const { data: employees, error: employeesError } = await actor.supabase
    .from("employees")
    .select("id, role, profile_id")
    .eq("branch_id", branchId)
    .eq("role", "MASTER_ADMIN")
    .eq("is_active", true)
    .limit(50);

  if (employeesError) throw new Error(employeesError.message);
  const rows = (employees ?? []) as { id: string; role: string; profile_id: string }[];
  if (rows.length === 0) return [];

  const { data: profiles, error: profilesError } = await actor.supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", rows.map((row) => row.profile_id));

  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map(((profiles ?? []) as { id: string }[]).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = byId.get(row.profile_id) as { id: string; full_name?: string | null; email?: string | null } | undefined;
    return {
      id: row.profile_id,
      employee_id: row.id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: row.role,
    };
  });
}
