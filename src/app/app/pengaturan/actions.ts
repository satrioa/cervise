"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/rbac";
import { publicPhotoUrl } from "@/lib/photos";

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
  //
  // Wajib lewat service role: 20260925122000_harden_auth_rls.sql:36 melakukan
  // `revoke insert, update, delete on table organizations from authenticated`,
  // jadi menulis lewat actor.supabase (anon key) selalu berakhir
  // "permission denied for table organizations". Baris org sudah dicegah lebih
  // dulu oleh canAccess + orgId dari actor, bukan oleh RLS.
  const { data, error } = await createAdminClient()
    .from("organizations")
    .update({ name })
    .eq("id", actor.orgId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisasi tidak ditemukan");

  // Sidebar membaca nama brand, jadi /app juga harus disegarkan.
  revalidatePath("/app/pengaturan");
  revalidatePath("/app");
  return { ok: true };
}

export async function getBrand(branchId: string) {
  const actor = await getActiveTenant();
  if (!canAccess(actor.role, "dashboard")) throw new Error("Role tidak diizinkan");
  if (!actor.orgId) throw new Error("Organisasi tidak ditemukan");

  const targetBranchId = resolveBranchId(actor, branchId);

  // Brand + logo milik TENANT (organizations). branches.logo_url sengaja tidak
  // dipakai: logo cabang tidak pernah ditulis dan tidak pernah ditampilkan.
  const [orgRes, branchRes] = await Promise.all([
    actor.supabase
      .from("organizations")
      .select("id, name, logo_url")
      .eq("id", actor.orgId)
      .maybeSingle(),
    targetBranchId
      ? actor.supabase
          .from("branches")
          .select("id, name")
          .eq("id", targetBranchId)
          .eq("organization_id", actor.orgId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgRes.error) throw new Error(orgRes.error.message);
  if (branchRes.error) throw new Error(branchRes.error.message);

  const org = orgRes.data as { id: string; name: string; logo_url: string | null } | null;
  const branch = branchRes.data as { id: string; name: string } | null;

  return {
    name: org?.name ?? null,
    branchName: branch?.name ?? null,
    // Path dari database divalidasi bentuknya dulu, lalu URL publik dibangun di
    // server. Kalau path-nya tidak lolos, hasilnya null dan UI jatuh ke
    // inisial lokal - bukan ke URL yang bisa diarahkan ke host lain.
    logoUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", org?.logo_url),
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
