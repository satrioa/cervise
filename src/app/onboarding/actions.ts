"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/tenant-slug";

export async function completeOnboarding(opts: { tenantName: string; branchName: string; alamat?: string; telepon?: string; paket: "trial" | "basic" | "pro" }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const name = opts.tenantName.trim();
  if (!name) throw new Error("Nama tenant wajib");
  if (name.length > 120) throw new Error("Nama maksimal 120 karakter");
  const paket = opts.paket;
  if (!["trial", "basic", "pro"].includes(paket)) throw new Error("Paket tidak valid");
  // check already has tenant
  const { data: existing } = await supabase.from("employees").select("id").eq("profile_id", auth.user.id).eq("is_active", true).limit(1);
  if (existing && existing.length > 0) throw new Error("Anda sudah memiliki tenant");

  const trial_ends_at = paket === "trial" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
  const baseSlug = slugify(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseSlug) || baseSlug.length < 3) throw new Error("Slug tidak valid");
  let slug = baseSlug;
  let attempt = 0;
  let org: { id: string } | null = null;
  while (true) {
    const { data, error } = await supabase.from("organizations").insert({ name, slug, paket, trial_ends_at, created_by: auth.user.id }).select("id").single();
    if (!error) { org = data as { id: string }; break; }
    if ((error as { code?: string }).code === "23505" && String(error.message).includes("slug")) {
      attempt++; slug = `${baseSlug.slice(0, 63 - `-${attempt + 1}`.length)}-${attempt + 1}`;
      if (attempt > 10) throw new Error(error.message);
      continue;
    }
    throw new Error(error.message);
  }
  const orgId = org!.id;
  const branchName = opts.branchName.trim() || "Cabang Pusat";
  const { data: branch, error: bErr } = await supabase.from("branches").insert({ organization_id: orgId, name: branchName, city: (opts.alamat ?? "").trim() || null, phone: (opts.telepon ?? "").trim() || null, is_active: true }).select("id").single();
  if (bErr) throw new Error(bErr.message);
  const branchId = (branch as { id: string }).id;
  const { data: prof } = await supabase.from("profiles").select("id").eq("id", auth.user.id).maybeSingle();
  if (!prof) {
    await supabase.from("profiles").insert({ id: auth.user.id, full_name: (auth.user.user_metadata as { full_name?: string } | null)?.full_name ?? null, email: auth.user.email ?? null });
  }
  const { error: eErr } = await supabase.from("employees").insert({ organization_id: orgId, branch_id: branchId, profile_id: auth.user.id, role: "MASTER_ADMIN", is_active: true });
  if (eErr) throw new Error(eErr.message);
  revalidatePath("/owner");
  revalidatePath("/app");
  return { organizationId: orgId, branchId };
}
