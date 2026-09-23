"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getProfileInitial() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const uid = auth.user.id;
  const email = auth.user.email ?? "";

  const { data: prof } = await supabase.from("profiles").select("full_name, phone, email, branch_id").eq("id", uid).maybeSingle();
  const { data: emp } = await supabase.from("employees").select("organization_id, branch_id, role").eq("profile_id", uid).maybeSingle();

  const branchId = (emp?.branch_id as string | null) ?? (prof?.branch_id as string | null) ?? null;
  const role = (emp?.role as string) ?? "MASTER_ADMIN";
  const isMasterAdmin = role === "MASTER_ADMIN" || role === "ADMIN";

  // cabang options
  let cabangOptions: { id: string; name: string }[] = [];
  if (emp?.organization_id) {
    const { data: branches } = await supabase.from("branches").select("id,name").eq("organization_id", emp.organization_id).order("created_at");
    cabangOptions = ((branches as any[]) ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  }
  if (cabangOptions.length === 0) {
    cabangOptions = [{ id: branchId ?? "default", name: "Cabang Utama" }];
  }

  return {
    fullName: (prof?.full_name as string) ?? auth.user.user_metadata?.full_name ?? "Master Admin",
    email: (prof?.email as string) ?? email,
    phone: (prof?.phone as string) ?? "",
    branchId,
    role,
    isMasterAdmin,
    cabangOptions,
  };
}

export async function updateProfile(data: { fullName: string; phone: string; branchId: string | null }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const uid = auth.user.id;

  const fullName = data.fullName.trim();
  if (!fullName) throw new Error("Nama wajib");
  if (fullName.length > 80) throw new Error("Nama maksimal 80 karakter");

  const phone = data.phone.trim() || null;

  const { data: emp } = await supabase.from("employees").select("branch_id, role, organization_id").eq("profile_id", uid).maybeSingle();
  const role = (emp?.role as string) ?? "MASTER_ADMIN";
  const isMasterAdmin = role === "MASTER_ADMIN" || role === "ADMIN";

  const { error: pErr } = await supabase.from("profiles").update({ full_name: fullName, phone } as any).eq("id", uid);
  if (pErr) throw new Error(pErr.message);

  if (isMasterAdmin && data.branchId) {
    const { error: eErr } = await supabase.from("employees").update({ branch_id: data.branchId } as any).eq("profile_id", uid);
    if (eErr) throw new Error(eErr.message);
    // also keep profiles.branch_id in sync if exists
    await supabase.from("profiles").update({ branch_id: data.branchId } as any).eq("id", uid);
  }

  revalidatePath("/app/pengaturan/profil");
  return { ok: true };
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login` } as any);
  if (error) throw new Error(error.message);
  return { ok: true };
}
