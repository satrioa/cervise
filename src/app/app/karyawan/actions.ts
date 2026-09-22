/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type BranchUser = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; employeeId: string; organizationId: string; branchId: string; role: string };

async function getBranchUser(): Promise<BranchUser> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: emp } = await supabase.from("employees").select("id, organization_id, branch_id, role").eq("profile_id", auth.user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!emp?.organization_id || !emp?.branch_id) throw new Error("Employee/branch not found");
  return { supabase, userId: auth.user.id, employeeId: emp.id as string, organizationId: emp.organization_id as string, branchId: emp.branch_id as string, role: String((emp as any).role ?? "") };
}

function requireManager(role: string) {
  if (role !== "MASTER_ADMIN" && role !== "ADMIN") throw new Error("Hanya manager boleh kelola karyawan");
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
  const { supabase, organizationId } = await getBranchUser();
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
  // fallback: fetch email from auth via admin (best-effort)
  let authMap: Map<string, string> | null = null;
  try {
    const admin = getAdminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 } as any);
    authMap = new Map((data.users ?? []).map((u: any) => [u.id, u.email as string]));
  } catch {}
  return (emps as any[]).map((e) => {
    const prof = pMap.get(e.profile_id);
    return {
      employeeId: e.id as string,
      profileId: e.profile_id as string,
      fullName: (prof?.full_name ?? "—") as string,
      email: (prof?.email ?? authMap?.get(e.profile_id) ?? null) as string | null,
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
  const { supabase, organizationId } = await getBranchUser();
  const { data } = await supabase.from("branches").select("id, name").eq("organization_id", organizationId).eq("is_active", true).order("name");
  return ((data ?? []) as any[]).map((b) => ({ id: b.id as string, name: b.name as string }));
}

export type CreateKaryawanInput = { fullName: string; email: string; phone?: string; role: string; branchId: string };

export async function createKaryawan(input: CreateKaryawanInput): Promise<{ employeeId: string; profileId: string; tempPassword: string }> {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Nama wajib");
  if (!email || !email.includes("@")) throw new Error("Email tidak valid");
  if (!input.branchId) throw new Error("Cabang wajib");
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"].includes(input.role)) throw new Error("Role tidak valid");
  const { data: branch } = await supabase.from("branches").select("id").eq("id", input.branchId).eq("organization_id", organizationId).maybeSingle();
  if (!branch) throw new Error("Cabang tidak ditemukan");
  const admin = getAdminClient();
  const tempPassword = genPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName } });
  if (cErr) throw new Error(cErr.message);
  const uid = created.user!.id as string;
  // wait for trigger to create profile, then patch
  await new Promise((r) => setTimeout(r, 300));
  await admin.from("profiles").update({ full_name: fullName, phone: (input.phone ?? "").trim() || null, email } as any).eq("id", uid);
  // supabase client uses anon policy - update via admin instead; fallback above
  await supabase.from("profiles").update({ full_name: fullName, phone: (input.phone ?? "").trim() || null, email } as any).eq("id", uid).then(() => {});
  const { data: emp, error: eErr } = await supabase.from("employees").insert({ organization_id: organizationId, branch_id: input.branchId, profile_id: uid, role: input.role, is_active: true }).select("id").single();
  if (eErr) {
    // rollback auth user
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    throw new Error(eErr.message);
  }
  revalidatePath("/app/karyawan");
  return { employeeId: (emp as any).id as string, profileId: uid, tempPassword };
}

export type UpdateKaryawanInput = { profileId: string; employeeId: string; fullName: string; phone?: string; email?: string; role: string; branchId: string };

export async function updateKaryawan(input: UpdateKaryawanInput) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Nama wajib");
  if (!input.branchId) throw new Error("Cabang wajib");
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"].includes(input.role)) throw new Error("Role tidak valid");
  const { data: emp } = await supabase.from("employees").select("id, organization_id").eq("id", input.employeeId).eq("organization_id", organizationId).maybeSingle();
  if (!emp) throw new Error("Karyawan tidak ditemukan");
  // update profile (name/phone)
  const patch: any = { full_name: fullName, phone: (input.phone ?? "").trim() || null };
  if (input.email && input.email.includes("@")) patch.email = input.email.trim().toLowerCase();
  await supabase.from("profiles").update(patch).eq("id", input.profileId);
  // also via admin to bypass RLS edge
  try { await getAdminClient().from("profiles").update(patch).eq("id", input.profileId); } catch {}
  if (input.email && input.email.includes("@")) {
    try { await getAdminClient().auth.admin.updateUserById(input.profileId, { email: input.email.trim().toLowerCase() }); } catch {}
  }
  const { error: eErr } = await supabase.from("employees").update({ role: input.role, branch_id: input.branchId }).eq("id", input.employeeId).eq("organization_id", organizationId);
  if (eErr) throw new Error(eErr.message);
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
  const { error } = await supabase.from("employees").update({ is_active: active }).eq("id", employeeId).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/karyawan");
  return { ok: true as const };
}

export async function deleteKaryawan(profileId: string, employeeId: string) {
  const { supabase, organizationId, role } = await getBranchUser();
  requireManager(role);
  // prevent deleting self
  const { data: me } = await supabase.from("employees").select("id, profile_id").eq("profile_id", (await supabase.auth.getUser()).data.user!.id).maybeSingle();
  if ((me as any)?.id === employeeId) throw new Error("Tidak bisa hapus diri sendiri");
  await supabase.from("employees").delete().eq("id", employeeId).eq("organization_id", organizationId);
  // also delete profile via admin (cascade may not)
  try { await getAdminClient().from("profiles").delete().eq("id", profileId); } catch {}
  try { await getAdminClient().auth.admin.deleteUser(profileId); } catch {}
  revalidatePath("/app/karyawan");
  return { ok: true as const };
}
