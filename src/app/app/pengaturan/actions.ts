"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";

/**
 * Branch selector Context memakai sentinel "all" untuk "Semua cabang", yang
 * bukan UUID. Query per-cabang dengan nilai itu selalu kosong, jadi resolve
 * dulu ke cabang yang benar-benar dimiliki actor.
 */
function resolveBranchId(actor: { branchId: string | null }, branchId: string): string | null {
  if (branchId && branchId !== "all") return branchId;
  return actor.branchId;
}

export async function updateBrand(input: { name: string }) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_general")) {
    throw new Error("Role tidak diizinkan mengubah pengaturan cabang");
  }
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new Error("Nama brand harus 2-80 karakter");

  // Brand = nama organisasi. branches.name adalah nama CABANG (mis. "Cabang
  // Pusat") dan hanya boleh diubah lewat pengaturan cabang terpisah.
  const { data, error } = await actor.supabase
    .from("organizations")
    .update({ name })
    .eq("id", actor.orgId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisasi tidak ditemukan");

  revalidatePath("/app/pengaturan");
  return { ok: true };
}

export async function getBrand(branchId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "dashboard")) throw new Error("Role tidak diizinkan");
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");

  const targetBranchId = resolveBranchId(actor, branchId);

  const [orgRes, branchRes] = await Promise.all([
    actor.supabase.from("organizations").select("id, name").eq("id", actor.orgId).maybeSingle(),
    targetBranchId
      ? actor.supabase
          .from("branches")
          .select("id, name, logo_url")
          .eq("id", targetBranchId)
          .eq("organization_id", actor.orgId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgRes.error) throw new Error(orgRes.error.message);
  if (branchRes.error) throw new Error(branchRes.error.message);

  const branch = branchRes.data as { id: string; name: string; logo_url: string | null } | null;
  return {
    name: (orgRes.data as { name: string } | null)?.name ?? null,
    branchName: branch?.name ?? null,
    logoUrl: branch?.logo_url ?? null,
  };
}

export async function getMasterAdmins(branchId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "pengaturan_general")) {
    throw new Error("Role tidak diizinkan melihat daftar admin");
  }

  const targetBranchId = resolveBranchId(actor, branchId);
  if (!targetBranchId) return [];

  // employees.role adalah sumber otoritas (uppercase). profiles.role hanya field
  // legacy lowercase, jadi jangan difilter dari sana.
  const { data: employees, error: employeesError } = await actor.supabase
    .from("employees")
    .select("id, role, profile_id")
    .eq("branch_id", targetBranchId)
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
