/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant, type Actor } from "@/lib/supabase/actor";
import { isEmployeeTargetInOrganization, isManagerRole } from "@/lib/auth/authorization";
import { canAccess } from "@/lib/rbac";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type BranchUser = { supabase: Actor["supabase"]; userId: string; employeeId: string; organizationId: string; branchId: string; role: string };

async function getBranchUser(): Promise<BranchUser> {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Employee/branch not found");
  return {
    supabase: actor.supabase,
    userId: actor.userId,
    employeeId: actor.employeeId,
    organizationId: actor.orgId,
    branchId: actor.branchId,
    role: actor.role,
  };
}

function requireManager(role: string) {
  if (!isManagerRole(role)) throw new Error("Hanya manager boleh kelola karyawan");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function genPassword(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) s += a[rnd[i] % a.length];
  return s + "1!";
}

export type KaryawanRow = {
  employeeId: string;
  profileId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function getKaryawan(): Promise<KaryawanRow[]> {
  const { supabase, organizationId, role } = await getBranchUser();
  if (!canAccess(role, "karyawan")) throw new Error("Hanya manager boleh melihat data karyawan");
  const { data: emps, error } = await supabase.from("employees").select("id, profile_id, role, branch_id, is_active, created_at").eq("organization_id", organizationId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!emps?.length) return [];
  const pIds = (emps as any[]).map((e) => e.profile_id).filter(Boolean);
  const bIds = (emps as any[]).map((e) => e.branch_id).filter(Boolean);
  const [{ data: profs }, { data: branches }] = await Promise.all([
    pIds.length ? supabase.from("profiles").select("id, full_name, phone, email").in("id", pIds) : Promise.resolve({ data: [] as any[] } as any),
    bIds.length ? supabase.from("branches").select("id, name").in("id", bIds) : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const pMap = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>();
  for (const p of (profs ?? []) as any[]) pMap.set(p.id, { full_name: p.full_name, phone: p.phone, email: (p as any).email ?? null });
  const bMap = new Map<string, string>();
  for (const b of (branches ?? []) as any[]) bMap.set(b.id, b.name);
  return (emps as any[]).map((e) => {
    const prof = pMap.get(e.profile_id);
    return {
      employeeId: e.id as string,
      profileId: e.profile_id as string,
      fullName: (prof?.full_name ?? "—") as string,
      email: (prof?.email ?? null) as string | null,
      phone: (prof?.phone ?? null) as string | null,
      role: String(e.role),
      branchId: (e.branch_id as string | null) ?? null,
      branchName: (e.branch_id ? bMap.get(e.branch_id) ?? null : null) as string | null,
      isActive: !!e.is_active,
      createdAt: e.created_at as string,
    };
  });
}

export async function getKaryawanBranches(): Promise<{ id: string; name: string }[]> {
  const { supabase, organizationId, role } = await getBranchUser();
  if (!canAccess(role, "karyawan")) throw new Error("Hanya manager boleh melihat data karyawan");
  const { data } = await supabase.from("branches").select("id, name").eq("organization_id", organizationId).eq("is_active", true).order("name");
  return ((data ?? []) as any[]).map((b) => ({ id: b.id as string, name: b.name as string }));
}

export type CreateKaryawanInput = { fullName: string; email: string; phone?: string; role: string; branchId: string };

export async function createKaryawan(input: CreateKaryawanInput): Promise<{ employeeId: string; profileId: string; tempPassword: string }> {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const targetRole = input.role.trim().toUpperCase();
  if (!fullName) throw new Error("Nama wajib");
  if (!email || !email.includes("@")) throw new Error("Email tidak valid");
  if (!input.branchId) throw new Error("Cabang wajib");
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"].includes(targetRole)) throw new Error("Role tidak valid");
  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("id", input.branchId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!branch) throw new Error("Cabang tidak ditemukan");
  const admin = getAdminClient();
  const tempPassword = genPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) throw new Error(createError?.message ?? "Gagal membuat akun");
  const uid = created.user.id;
  const profilePatch = {
    id: uid,
    full_name: fullName,
    phone: input.phone?.trim() || null,
    email,
    role: targetRole,
  };
  const { error: profileError } = await admin.from("profiles").upsert(profilePatch, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(uid);
    throw new Error(profileError.message);
  }
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .insert({ organization_id: organizationId, branch_id: input.branchId, profile_id: uid, role: targetRole, is_active: true })
    .select("id")
    .single();
  if (employeeError || !employee) {
    await admin.auth.admin.deleteUser(uid);
    throw new Error(employeeError?.message ?? "Gagal membuat karyawan");
  }
  revalidatePath("/app/karyawan");
  return { employeeId: employee.id as string, profileId: uid, tempPassword };
}

export type UpdateKaryawanInput = { profileId: string; employeeId: string; fullName: string; phone?: string; email?: string; role: string; branchId: string };

export async function updateKaryawan(input: UpdateKaryawanInput) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const fullName = input.fullName.trim();
  const targetRole = input.role.trim().toUpperCase();
  const email = input.email?.trim().toLowerCase() || null;
  if (!fullName) throw new Error("Nama wajib");
  if (!input.branchId) throw new Error("Cabang wajib");
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"].includes(targetRole)) throw new Error("Role tidak valid");
  if (email && !email.includes("@")) throw new Error("Email tidak valid");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, profile_id")
    .eq("id", input.employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!employee || !isEmployeeTargetInOrganization({
    organization_id: String(employee.organization_id),
    branch_id: employee.branch_id,
    profile_id: String(employee.profile_id),
  }, organizationId)) {
    throw new Error("Karyawan tidak ditemukan");
  }
  if (input.profileId && input.profileId !== employee.profile_id) {
    throw new Error("Target profile tidak valid");
  }

  const { data: targetBranch } = await supabase
    .from("branches")
    .select("id")
    .eq("id", input.branchId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!targetBranch) throw new Error("Cabang tidak ditemukan");

  const { data: updatedEmployee, error: employeeError } = await supabase
    .from("employees")
    .update({ role: targetRole, branch_id: input.branchId })
    .eq("id", input.employeeId)
    .eq("organization_id", organizationId)
    .select("id")
    .single();
  if (employeeError || !updatedEmployee) throw new Error(employeeError?.message ?? "Gagal memperbarui karyawan");

  const profilePatch: Record<string, unknown> = {
    full_name: fullName,
    phone: input.phone?.trim() || null,
  };
  if (email) profilePatch.email = email;
  const admin = getAdminClient();
  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", employee.profile_id)
    .select("id")
    .single();
  if (profileError || !updatedProfile) throw new Error(profileError?.message ?? "Gagal memperbarui profile");

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(employee.profile_id, { email });
    if (authError) throw new Error(authError.message);
  }

  revalidatePath("/app/karyawan");
  return { ok: true as const };
}

export async function resetKaryawanPassword(profileId: string) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", profileId).eq("organization_id", organizationId).maybeSingle();
  if (!emp) throw new Error("Karyawan tidak ditemukan");
  let email: string | null = null;
  const { data: prof } = await supabase.from("profiles").select("email").eq("id", profileId).maybeSingle();
  email = (prof as any)?.email ?? null;
  if (!email) {
    const { data } = await getAdminClient().auth.admin.getUserById(profileId);
    email = (data.user as any)?.email ?? null;
  }
  if (!email) throw new Error("Email tidak ditemukan");
  // use anon client reset (sends email)
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback` } as any);
  // fallback: admin invite
  if (error) {
    const { error: aErr } = await getAdminClient().auth.admin.generateLink({ type: "recovery", email } as any);
    if (aErr) throw new Error(aErr.message);
  }
  return { ok: true as const, email };
}

export async function setKaryawanActive(employeeId: string, active: boolean) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const { data: employee, error } = await supabase
    .from("employees")
    .update({ is_active: active })
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .select("id")
    .single();
  if (error || !employee) throw new Error(error?.message ?? "Karyawan tidak ditemukan");
  revalidatePath("/app/karyawan");
  return { ok: true as const };
}

export async function deleteKaryawan(profileId: string, employeeId: string) {
  const { supabase, organizationId, role, employeeId: actorEmployeeId } = await getBranchUser();
  requireManager(role);
  if (actorEmployeeId === employeeId) throw new Error("Tidak bisa hapus diri sendiri");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, profile_id")
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!employee || !isEmployeeTargetInOrganization({
    organization_id: String(employee.organization_id),
    branch_id: employee.branch_id,
    profile_id: String(employee.profile_id),
  }, organizationId)) {
    throw new Error("Karyawan tidak ditemukan");
  }
  if (profileId !== employee.profile_id) throw new Error("Target profile tidak valid");

  const admin = getAdminClient();
  const { data: otherAssignments, error: assignmentsError } = await admin
    .from("employees")
    .select("id")
    .eq("profile_id", profileId)
    .neq("id", employeeId)
    .limit(1);
  if (assignmentsError) throw new Error(assignmentsError.message);
  if ((otherAssignments ?? []).length > 0) {
    throw new Error("Karyawan masih memiliki assignment tenant lain");
  }

  const { data: deletedEmployee, error: employeeError } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .select("id")
    .single();
  if (employeeError || !deletedEmployee) throw new Error(employeeError?.message ?? "Karyawan tidak ditemukan");

  const { error: profileError } = await admin.from("profiles").delete().eq("id", profileId);
  if (profileError) throw new Error(profileError.message);
  const { error: authError } = await admin.auth.admin.deleteUser(profileId);
  if (authError) throw new Error(authError.message);

  revalidatePath("/app/karyawan");
  return { ok: true as const };
}
