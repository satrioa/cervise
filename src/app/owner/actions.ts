"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/tenant-slug";

export async function getTenants() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  // tenants where user is creator or employee
  const { data: orgs, error } = await supabase.from("organizations").select("id, name, slug, paket, trial_ends_at, created_at, created_by").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // filter to orgs where user is member or creator (if RLS allows all, filter client side)
  const { data: emps } = await supabase.from("employees").select("organization_id").eq("profile_id", auth.user.id).eq("is_active", true);
  const myOrgIds = new Set((emps ?? []).map((e: any) => e.organization_id));
  // also include orgs created by user
  const filtered = (orgs ?? []).filter((o: any) => o.created_by === auth.user.id || myOrgIds.has(o.id));
  // if no filter (single-tenant demo), return all where RLS allows
  const list = filtered.length ? filtered : (orgs ?? []);
  // enrich with cabang count and paket
  const orgIds = list.map((o: any) => o.id);
  let cabangCounts = new Map<string, number>();
  if (orgIds.length) {
    const { data: branches } = await supabase.from("branches").select("organization_id").in("organization_id", orgIds);
    for (const b of (branches ?? []) as any[]) {
      cabangCounts.set(b.organization_id, (cabangCounts.get(b.organization_id) ?? 0) + 1);
    }
  }
  // enrich owner email
  const creatorIds = [...new Set(list.map((o: any) => o.created_by).filter(Boolean))] as string[];
  let creatorMap = new Map<string, string>();
  if (creatorIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", creatorIds);
    for (const p of (profs ?? []) as any[]) creatorMap.set(p.id, p.email ?? p.full_name ?? p.id.slice(0, 8));
  }
  return list.map((o: any) => ({
    id: o.id as string,
    name: o.name as string,
    slug: (o as any).slug as string,
    paket: (o as any).paket ?? "trial",
    trial_ends_at: (o as any).trial_ends_at as string | null,
    created_at: o.created_at as string,
    owner: creatorMap.get(o.created_by as string) ?? "-",
    cabangCount: cabangCounts.get(o.id as string) ?? 0,
  }));
}

export async function createTenant(form: { name: string; paket: "trial" | "basic" | "pro" }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const name = form.name.trim();
  if (!name) throw new Error("Nama tenant wajib");
  if (name.length > 120) throw new Error("Nama maksimal 120");
  const paket = form.paket ?? "trial";
  if (!["trial", "basic", "pro"].includes(paket)) throw new Error("Paket invalid");
  const trial_ends_at = paket === "trial" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;

  const baseSlug = slugify(name);
  if (!baseSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseSlug) || baseSlug.length < 3) throw new Error("Slug tidak valid dari nama");
  let slug = baseSlug;
  let attempt = 0;
  let org: any = null;
  while (true) {
    const { data, error } = await supabase.from("organizations").insert({ name, slug, paket, trial_ends_at, created_by: auth.user.id }).select("id").single();
    if (!error) { org = data; break; }
    if ((error as any).code === "23505" && String(error.message).includes("slug")) {
      attempt += 1;
      if (attempt > 10) throw new Error("Gagal generate slug unik");
      const suffix = `-${attempt + 1}`;
      slug = baseSlug.slice(0, 63 - suffix.length) + suffix;
      continue;
    }
    throw new Error(error.message);
  }
  const orgId = (org as any).id as string;

  // create default branch Project Pusat
  const { data: branch, error: bErr } = await supabase.from("branches").insert({ organization_id: orgId, name: "Cabang Pusat", city: "", phone: "", is_active: true }).select("id").single();
  if (bErr) throw new Error(bErr.message);
  const branchId = (branch as any).id as string;

  // ensure profile exists
  const { data: prof } = await supabase.from("profiles").select("id").eq("id", auth.user.id).maybeSingle();
  if (!prof) {
    await supabase.from("profiles").insert({ id: auth.user.id, full_name: (auth.user.user_metadata as any)?.full_name ?? null, email: auth.user.email ?? null });
  }

  // create employee as MASTER_ADMIN for this tenant
  const { error: eErr } = await supabase.from("employees").insert({ organization_id: orgId, branch_id: branchId, profile_id: auth.user.id, role: "MASTER_ADMIN", is_active: true });
  if (eErr) throw new Error(eErr.message);

  revalidatePath("/owner");
  revalidatePath("/app");
  return { id: orgId };
}
