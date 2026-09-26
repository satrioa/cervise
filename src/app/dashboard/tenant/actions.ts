"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionAccessState,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/renewal";

export async function selectTenant(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  if (!organizationId) throw new Error("Tenant tidak valid");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/tenant");

  const [platformAdminResult, membershipsResult] = await Promise.all([
    supabase
      .from("platform_admins")
      .select("profile_id")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("id, organization_id, role")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true),
  ]);
  if (platformAdminResult.error) throw new Error("Gagal memverifikasi platform admin");
  if (membershipsResult.error) throw new Error("Gagal memverifikasi akses tenant");
  if (platformAdminResult.data) redirect("/owner");

  const memberships = (membershipsResult.data ?? []) as { id: string; organization_id: string; role: string }[];
  const membership = memberships.find((row) => row.organization_id === organizationId);
  if (!membership) throw new Error("Anda tidak memiliki akses ke tenant ini");
  if (membership.role.toUpperCase() !== "MASTER_ADMIN" && memberships.length > 1) {
    throw new Error("Akun memiliki lebih dari satu assignment tenant");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) throw new Error("Gagal memuat tenant");
  if (!organization || ["blocked", "suspended", "cancelled"].includes(organization.status)) {
    throw new Error("Tenant tidak aktif");
  }

  const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("tenant_subscriptions")
      .select("status, current_period_end, trial_ends_at, grace_days")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (profileError) throw new Error(profileError.message);
  if (!profile?.is_active) throw new Error("Profil tidak aktif");
  if (subscriptionError) throw new Error(subscriptionError.message);
  if (!subscription) throw new Error("Subscription tenant tidak ditemukan");

  const status = subscription.status as SubscriptionLifecycleStatus;
  const currentPeriodEnd = subscription.current_period_end as string | null;
  const trialEndsAt = subscription.trial_ends_at as string | null;
  const graceDays = (subscription.grace_days as number | null) ?? 3;
  if (status === "trial" && (!trialEndsAt || new Date(trialEndsAt) <= new Date())) {
    throw new Error("Masa trial tenant telah berakhir");
  }
  if (status === "active" || status === "grace") {
    if (!currentPeriodEnd) throw new Error("Periode subscription tidak valid");
    const accessStatus = getSubscriptionAccessState({
      status,
      currentPeriodEnd: new Date(currentPeriodEnd),
      graceDays,
      now: new Date(),
    });
    if (["blocked", "suspended", "cancelled"].includes(accessStatus)) {
      throw new Error("Akses tenant diblokir");
    }
  }
  if (["blocked", "suspended", "cancelled"].includes(status)) {
    throw new Error("Akses tenant diblokir");
  }

  const cookieStore = await cookies();
  cookieStore.set("cervise_org", organizationId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/app");
}
