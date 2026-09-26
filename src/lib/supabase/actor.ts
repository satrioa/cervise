import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  getSubscriptionAccessState,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/renewal";
import type { TenantAccessErrorCode } from "@/lib/auth/authorization";

export class TenantAccessError extends Error {
  readonly code: TenantAccessErrorCode;

  constructor(code: TenantAccessErrorCode, message: string) {
    super(message);
    this.name = "TenantAccessError";
    this.code = code;
  }
}

type EmployeeRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  role: string;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  paket: string | null;
  trial_ends_at: string | null;
  status: string;
};

export type Actor = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  role: string;
  subscription: {
    status: SubscriptionLifecycleStatus;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    graceDays: number;
  } | null;
};

export async function getActiveTenant(): Promise<Actor> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new TenantAccessError("unauthenticated", "Unauthorized");

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
  if (empsErr) throw new TenantAccessError("lookup_failed", empsErr.message);
  if (!emps || emps.length === 0) throw new TenantAccessError("tenant_not_found", "Tenant not found — buat tenant dulu di /owner");

  const hasOwnerMembership = emps.some(
    (employee) => String(employee.role).toUpperCase() === "MASTER_ADMIN",
  );
  const hasValidTargetOrg = Boolean(
    targetOrgId && emps.some((employee) => employee.organization_id === targetOrgId),
  );

  if (emps.length > 1 && !hasOwnerMembership) {
    throw new TenantAccessError("assignment_required", "Akun memiliki lebih dari satu assignment tenant");
  }
  if (emps.length > 1 && !hasValidTargetOrg) {
    throw new TenantAccessError("assignment_required", "Pilih tenant terlebih dahulu");
  }
  if (!targetOrgId || !hasValidTargetOrg) {
    targetOrgId = emps[0].organization_id;
  }

  const actorRow = emps.find((employee) => employee.organization_id === targetOrgId) as EmployeeRow;
  if (!actorRow) throw new TenantAccessError("tenant_not_found", "Tidak punya akses ke tenant ini");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) throw new TenantAccessError("lookup_failed", profileError.message);
  if (!profile?.is_active) throw new TenantAccessError("profile_inactive", "Profil tidak aktif");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", targetOrgId)
    .maybeSingle();
  if (organizationError) throw new TenantAccessError("lookup_failed", organizationError.message);
  if (!organization || ["blocked", "suspended", "cancelled"].includes(organization.status)) {
    throw new TenantAccessError("subscription_blocked", "Organisasi tenant tidak aktif");
  }

  if (actorRow.branch_id) {
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("id", actorRow.branch_id)
      .eq("organization_id", targetOrgId)
      .eq("is_active", true)
      .maybeSingle();
    if (branchError) throw new TenantAccessError("lookup_failed", "Gagal memverifikasi cabang");
    if (!branch) throw new TenantAccessError("branch_invalid", "Cabang tidak valid untuk tenant ini");
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("tenant_subscriptions")
    .select("status, current_period_end, trial_ends_at, grace_days")
    .eq("organization_id", targetOrgId)
    .maybeSingle();
  if (subscriptionError) throw new TenantAccessError("lookup_failed", subscriptionError.message);

  let subscription: Actor["subscription"] = null;
  if (subscriptionRow) {
    let status = subscriptionRow.status as SubscriptionLifecycleStatus;
    const currentPeriodEnd = subscriptionRow.current_period_end as string | null;
    const trialEndsAt = subscriptionRow.trial_ends_at as string | null;
    const graceDays = (subscriptionRow.grace_days as number | null) ?? 3;

    if (status === "trial" && (!trialEndsAt || new Date(trialEndsAt) <= new Date())) {
      throw new TenantAccessError("subscription_blocked", "Masa trial tenant telah berakhir");
    }

    if (status === "active" || status === "grace") {
      if (!currentPeriodEnd) throw new TenantAccessError("subscription_blocked", "Periode subscription tidak valid");
      status = getSubscriptionAccessState({
        status,
        currentPeriodEnd: new Date(currentPeriodEnd),
        graceDays,
        now: new Date(),
      });
    }

    if (status === "blocked" || status === "suspended" || status === "cancelled") {
      throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir. Hubungi platform owner untuk pembayaran.");
    }

    subscription = { status, currentPeriodEnd, trialEndsAt, graceDays };
  } else {
    throw new TenantAccessError("subscription_blocked", "Subscription tenant tidak ditemukan");
  }

  return {
    supabase,
    userId: auth.user.id,
    orgId: actorRow.organization_id as string,
    branchId: (actorRow.branch_id as string | null) ?? null,
    employeeId: actorRow.id as string,
    role: (actorRow.role as string) ?? "TECHNICIAN",
    subscription,
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
  if (!auth.user) throw new TenantAccessError("unauthenticated", "Unauthorized");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const { data: org, error: orgErr } = await supabase.from("organizations").select("id, name, slug, paket, trial_ends_at, status").eq("slug", slug).maybeSingle();
  if (orgErr) throw new TenantAccessError("lookup_failed", orgErr.message);
  if (!org) notFound();
  if (["blocked", "suspended", "cancelled"].includes(org.status)) {
    throw new TenantAccessError("subscription_blocked", "Organisasi tenant tidak aktif");
  }
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("organization_id", (org as TenantRow).id)
    .eq("is_active", true)
    .maybeSingle();
  if (empErr) throw new TenantAccessError("lookup_failed", empErr.message);
  if (!emp) notFound();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) throw new TenantAccessError("lookup_failed", profileError.message);
  if (!profile?.is_active) throw new TenantAccessError("profile_inactive", "Profil tidak aktif");

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("id", emp.branch_id)
    .eq("organization_id", emp.organization_id)
    .eq("is_active", true)
    .maybeSingle();
  if (branchError) throw new TenantAccessError("lookup_failed", branchError.message);
  if (!branch) throw new TenantAccessError("branch_invalid", "Cabang tidak valid untuk tenant ini");

  const { data: subscription, error: subscriptionError } = await supabase
    .from("tenant_subscriptions")
    .select("status, current_period_end, trial_ends_at, grace_days")
    .eq("organization_id", emp.organization_id)
    .maybeSingle();
  if (subscriptionError) throw new TenantAccessError("lookup_failed", subscriptionError.message);
  if (!subscription) throw new TenantAccessError("subscription_blocked", "Subscription tenant tidak ditemukan");

  const subscriptionStatus = subscription.status as SubscriptionLifecycleStatus;
  const currentPeriodEnd = subscription.current_period_end as string | null;
  const trialEndsAt = subscription.trial_ends_at as string | null;
  const graceDays = (subscription.grace_days as number | null) ?? 3;
  if (subscriptionStatus === "trial" && (!trialEndsAt || new Date(trialEndsAt) <= new Date())) {
    throw new TenantAccessError("subscription_blocked", "Masa trial tenant telah berakhir");
  }
  if (subscriptionStatus === "active" || subscriptionStatus === "grace") {
    if (!currentPeriodEnd) throw new TenantAccessError("subscription_blocked", "Periode subscription tidak valid");
    const accessStatus = getSubscriptionAccessState({
      status: subscriptionStatus,
      currentPeriodEnd: new Date(currentPeriodEnd),
      graceDays,
      now: new Date(),
    });
    if (accessStatus === "blocked" || accessStatus === "suspended" || accessStatus === "cancelled") {
      throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir");
    }
  }
  if (["blocked", "suspended", "cancelled"].includes(subscriptionStatus)) {
    throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir");
  }

  return { organization: org as TenantRow, employee: emp as EmployeeRow, supabase, userId: auth.user.id };
}
