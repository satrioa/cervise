import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export type Actor = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  role: string;
};

export async function getActiveTenant(): Promise<Actor> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const orgFromCookie = cookieStore.get("cervise_org")?.value ?? null;
  const orgFromHeader = null; // placeholder for x-tenant-id if needed via middleware

  // try active org from cookie/header, else first active employee org
  let targetOrgId: string | null = orgFromCookie ?? orgFromHeader;

  // fetch all active employees for user
  const { data: emps, error: empsErr } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true);
  if (empsErr) throw new Error(empsErr.message);
  if (!emps || emps.length === 0) throw new Error("Tenant not found — buat tenant dulu di /owner");

  if (!targetOrgId || !emps.some((e: any) => e.organization_id === targetOrgId)) {
    targetOrgId = (emps[0] as any).organization_id as string;
  }

  const actorRow = emps.find((e: any) => e.organization_id === targetOrgId) as any;
  if (!actorRow) throw new Error("Tidak punya akses ke tenant ini");

  return {
    supabase,
    userId: auth.user.id,
    orgId: actorRow.organization_id as string,
    branchId: (actorRow.branch_id as string | null) ?? null,
    employeeId: actorRow.id as string,
    role: (actorRow.role as string) ?? "TECHNICIAN",
  };
}

export async function getActiveTenantStrict(): Promise<Actor> {
  return getActiveTenant();
}

export async function requireMasterAdmin(): Promise<Actor> {
  const actor = await getActiveTenant();
  if (!["MASTER_ADMIN", "ADMIN"].includes(actor.role)) throw new Error("Hanya Master Admin");
  return actor;
}

export async function getTenantBySlugForCurrentUser(slug: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const { data: org, error: orgErr } = await supabase.from("organizations").select("id, name, slug, paket, trial_ends_at").eq("slug", slug).maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org) notFound();
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("organization_id", (org as any).id)
    .eq("is_active", true)
    .maybeSingle();
  if (empErr) throw new Error(empErr.message);
  if (!emp) notFound();
  return { organization: org as any, employee: emp as any, supabase, userId: auth.user.id };
}
