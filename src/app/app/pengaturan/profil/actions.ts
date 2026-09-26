"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getProfileInitial() {
  const actor = await getActiveTenant();
  const supabase = actor.supabase;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const uid = actor.userId;
  const email = auth.user.email ?? "";

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, phone, email, branch_id")
    .eq("id", uid)
    .maybeSingle();
  const { data: emp } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", uid)
    .eq("organization_id", actor.orgId)
    .eq("is_active", true)
    .maybeSingle();

  const branchId = (emp?.branch_id as string | null) ?? null;
  const role = (emp?.role as string) ?? actor.role;
  const isMasterAdmin = role === "MASTER_ADMIN" || role === "ADMIN";

  const { data: branches } = await supabase
    .from("branches")
    .select("id,name")
    .eq("organization_id", actor.orgId)
    .eq("is_active", true)
    .order("created_at");
  const cabangOptions = (branches ?? []).map((branch) => ({
    id: String(branch.id),
    name: String(branch.name),
  }));

  return {
    fullName: (prof?.full_name as string) ?? auth.user.user_metadata?.full_name ?? "Pengguna",
    email: (prof?.email as string) ?? email,
    phone: (prof?.phone as string) ?? "",
    branchId,
    role,
    isMasterAdmin,
    cabangOptions,
  };
}

export async function updateProfile(data: { fullName: string; phone: string; branchId: string | null }) {
  const actor = await getActiveTenant();
  const supabase = actor.supabase;
  const uid = actor.userId;

  const fullName = data.fullName.trim();
  if (!fullName) throw new Error("Nama wajib");
  if (fullName.length > 80) throw new Error("Nama maksimal 80 karakter");

  const phone = data.phone.trim() || null;
  const { data: emp } = await supabase
    .from("employees")
    .select("id, branch_id, role, organization_id")
    .eq("profile_id", uid)
    .eq("organization_id", actor.orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (!emp) throw new Error("Employee tidak ditemukan");

  const branchChanged = Boolean(data.branchId && data.branchId !== emp.branch_id);
  if (branchChanged) {
    if (emp.role !== "MASTER_ADMIN") throw new Error("Hanya Master Admin yang dapat memindahkan cabang");
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("id", data.branchId!)
      .eq("organization_id", actor.orgId)
      .eq("is_active", true)
      .maybeSingle();
    if (!branch) throw new Error("Cabang tidak valid untuk tenant ini");
    const { data: updatedEmployee, error: employeeError } = await supabase
      .from("employees")
      .update({ branch_id: data.branchId })
      .eq("id", emp.id)
      .eq("organization_id", actor.orgId)
      .select("id")
      .single();
    if (employeeError || !updatedEmployee) throw new Error(employeeError?.message ?? "Gagal memindahkan cabang");
  }

  const profilePatch: Record<string, unknown> = { full_name: fullName, phone };
  if (branchChanged) profilePatch.branch_id = data.branchId;
  const profileClient = branchChanged ? createAdminClient() : supabase;
  const { error: profileError } = await profileClient
    .from("profiles")
    .update(profilePatch)
    .eq("id", uid);
  if (profileError) throw new Error(profileError.message);

  revalidatePath("/app/pengaturan/profil");
  return { ok: true };
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const requestedEmail = email.trim().toLowerCase();
  const accountEmail = auth.user.email?.trim().toLowerCase() ?? "";
  if (!accountEmail || requestedEmail !== accountEmail) throw new Error("Email tidak sesuai dengan akun");
  const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
