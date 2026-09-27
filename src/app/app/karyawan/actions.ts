/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant, type Actor } from "@/lib/supabase/actor";
import { isEmployeeTargetInOrganization, isManagerRole } from "@/lib/auth/authorization";
import { canAccess } from "@/lib/rbac";
import { generateTempPassword } from "@/lib/auth/password";
import { EMPLOYEE_TO_PROFILE_ROLE, canManageEmployees } from "@/lib/auth/account-input";
import { publicPhotoUrl } from "@/lib/photos";
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

export type KaryawanRow = {
  employeeId: string;
  profileId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  branchId: string | null;
  branchName: string | null;
  /** URL foto publik; null = belum ada foto. */
  avatarUrl: string | null;
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
    pIds.length ? supabase.from("profiles").select("id, full_name, phone, email, avatar_url").in("id", pIds) : Promise.resolve({ data: [] as any[] } as any),
    bIds.length ? supabase.from("branches").select("id, name").in("id", bIds) : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const pMap = new Map<string, { full_name: string | null; phone: string | null; email: string | null; avatarUrl: string | null }>();
  for (const p of (profs ?? []) as any[])
    pMap.set(p.id, {
      full_name: p.full_name,
      phone: p.phone,
      email: p.email ?? null,
      avatarUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", p.avatar_url ?? null),
    });
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
      avatarUrl: prof?.avatarUrl ?? null,
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
  // Gate mengikuti policy employees_insert, bukan requireManager() yang juga
  // menerima ADMIN - ADMIN akan lolos di sini lalu ditolak RLS diam-diam.
  if (!canManageEmployees(role)) throw new Error("Hanya Master Admin yang bisa menambah karyawan.");
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
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) throw new Error(createError?.message ?? "Gagal membuat akun");
  const uid = created.user.id;

  // profiles.role dan employees.role memakai KASUS BEDA dan masing-masing punya
  // CHECK constraint: profiles huruf kecil (schema.sql:20), employees huruf
  // besar. Sebelumnya targetRole yang sudah uppercase ditulis ke keduanya, jadi
  // insert ke profiles selalu ditolak dan tidak ada karyawan yang pernah
  // berhasil dibuat. Kedua bentuk diambil dari konstanta yang sama.
  const profileRole = EMPLOYEE_TO_PROFILE_ROLE[targetRole];
  if (!profileRole) throw new Error("Role tidak valid");

  const profilePatch = {
    id: uid,
    full_name: fullName,
    phone: input.phone?.trim() || null,
    email,
    role: profileRole,
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
    // Baris profiles HARUS ikut dihapus. Dulu rollback hanya menghapus user
    // auth, meninggalkan profiles yatim - email itu lalu terlihat "sudah
    // dipakai" walau tidak ada akun yang bisa login.
    await admin.from("profiles").delete().eq("id", uid);
    await admin.auth.admin.deleteUser(uid);
    const detail = employeeError?.message ?? "Gagal membuat karyawan";
    // employees_insert hanya mengizinkan MASTER_ADMIN. Kalau pemanggilnya
    // ADMIN, RLS menolak tanpa penjelasan yang berguna untuk user.
    if (/employees_insert|row-level security|permission denied/i.test(detail)) {
      throw new Error("Gagal membuat karyawan. Hanya Master Admin yang bisa menambah karyawan.");
    }
    throw new Error(detail);
  }
  revalidatePath("/app/karyawan");
  return { employeeId: employee.id as string, profileId: uid, tempPassword };
}

export type UpdateKaryawanInput = { profileId: string; employeeId: string; fullName: string; phone?: string; email?: string; role: string; branchId: string };

export async function updateKaryawan(input: UpdateKaryawanInput) {
  const { supabase, organizationId, role } = await getBranchUser();
  if (!canManageEmployees(role)) throw new Error("Hanya Master Admin yang bisa mengubah karyawan.");
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
    .select("id, organization_id, branch_id, profile_id, role")
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

  // Nilai lama diambil lebih dulu supaya tiga tulisan di bawah bisa dibatalkan
  // kalau salah satunya gagal. Tanpa ini, employees bisa sudah pindah role
  // sementara profiles masih menyimpan data lama - atau sebaliknya.
  const profileId = employee.profile_id as string;
  const admin = getAdminClient();
  const { data: previousProfile, error: previousProfileError } = await admin
    .from("profiles")
    .select("full_name, phone, email, role")
    .eq("id", profileId)
    .maybeSingle();
  if (previousProfileError) throw new Error(previousProfileError.message);

  const previousRole = String(employee.role);
  const previousBranchId = employee.branch_id as string | null;

  async function restoreEmployee(): Promise<void> {
    const { error } = await supabase
      .from("employees")
      .update({ role: previousRole, branch_id: previousBranchId })
      .eq("id", input.employeeId)
      .eq("organization_id", organizationId);
    if (error) console.error("gagal mengembalikan employees:", error.message);
  }

  async function restoreProfile(): Promise<void> {
    if (!previousProfile) return;
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: previousProfile.full_name ?? null,
        phone: previousProfile.phone ?? null,
        email: previousProfile.email ?? null,
        role: previousProfile.role,
      })
      .eq("id", profileId);
    if (error) console.error("gagal mengembalikan profiles:", error.message);
  }

  const { data: updatedEmployee, error: employeeError } = await supabase
    .from("employees")
    .update({ role: targetRole, branch_id: input.branchId })
    .eq("id", input.employeeId)
    .eq("organization_id", organizationId)
    .select("id")
    .single();
  if (employeeError || !updatedEmployee) {
    const detail = employeeError?.message ?? "Gagal memperbarui karyawan";
    if (/employees_update|row-level security|permission denied/i.test(detail)) {
      throw new Error("Gagal memperbarui karyawan. Hanya Master Admin yang bisa mengubah karyawan.");
    }
    throw new Error(detail);
  }

  const profilePatch: Record<string, unknown> = {
    full_name: fullName,
    phone: input.phone?.trim() || null,
  };
  if (email) profilePatch.email = email;
  // profiles.role tidak disentuh sama sekali sebelumnya, jadi mengubah peran
  // lewat UI hanya mengubah employees.role dan membuat dua tabel berbeda
  // pendapat. profiles.role kini disinkronkan dengan bentuk huruf kecilnya.
  const profileRole = EMPLOYEE_TO_PROFILE_ROLE[targetRole];
  if (profileRole) profilePatch.role = profileRole;

  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", profileId)
    .select("id")
    .single();
  if (profileError || !updatedProfile) {
    // employees sudah berubah; kembalikan supaya tidak ada karyawan yang
    // punya role di satu tabel dan role berbeda di tabel lain.
    await restoreEmployee();
    throw new Error(profileError?.message ?? "Gagal memperbarui profile");
  }

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(profileId, { email });
    if (authError) {
      // profiles sudah ditulis email baru sementara auth masih email lama.
      // Kembalikan keduanya supaya tidak ada akun yang tidak bisa login.
      await restoreProfile();
      await restoreEmployee();
      throw new Error(authError.message);
    }
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
