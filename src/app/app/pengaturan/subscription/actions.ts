"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenantStrict } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";

function requireSubscriptionAccess(role: string) {
  if (!canAccess(role, "pengaturan_subscription")) {
    throw new Error("Role tidak diizinkan mengakses billing");
  }
}

type PackageShape = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  branch_limit: number;
  user_limit: number | null;
};

type SubscriptionShape = {
  id: string;
  status: string;
  custom_monthly_price: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_days: number;
  package: PackageShape | PackageShape[] | null;
};

type InvoiceShape = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  whatsapp_sent_at: string | null;
  decision_note: string | null;
  package: { name: string } | { name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getTenantBilling() {
  const actor = await getActiveTenantStrict();
  requireSubscriptionAccess(actor.role);
  const [subscriptionResult, invoiceResult, packageResult, contactResult] = await Promise.all([
    actor.supabase
      .from("tenant_subscriptions")
      .select(
        "id, status, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!inner(id, code, name, description, monthly_price, branch_limit, user_limit)",
      )
      .eq("organization_id", actor.orgId)
      .maybeSingle(),
    actor.supabase
      .from("invoices")
      .select("id, invoice_number, invoice_type, status, amount, period_start, period_end, due_date, whatsapp_sent_at, decision_note, package:packages!inner(name)")
      .eq("organization_id", actor.orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    actor.supabase
      .from("packages")
      .select("id, code, name, description, monthly_price, branch_limit, user_limit")
      .eq("is_active", true)
      .neq("code", "trial")
      .order("sort_order", { ascending: true }),
    actor.supabase.rpc("get_platform_contact").maybeSingle(),
  ]);

  if (subscriptionResult.error) throw subscriptionResult.error;
  if (invoiceResult.error) throw invoiceResult.error;
  if (packageResult.error) throw packageResult.error;
  if (contactResult.error) throw contactResult.error;

  const rawSubscription = subscriptionResult.data as SubscriptionShape | null;
  const subscription = rawSubscription
    ? { ...rawSubscription, package: firstRelation(rawSubscription.package) }
    : null;
  const invoices = ((invoiceResult.data ?? []) as InvoiceShape[]).map((invoice) => ({
    ...invoice,
    package: firstRelation(invoice.package),
  }));

  return {
    organizationId: actor.orgId,
    role: actor.role,
    subscription,
    invoices,
    packages: (packageResult.data ?? []) as PackageShape[],
    contact: (contactResult.data as { owner_whatsapp: string | null; owner_email: string | null } | null) ?? {
      owner_whatsapp: null,
      owner_email: null,
    },
  };
}

export async function requestPackage(packageId: string) {
  const actor = await getActiveTenantStrict();
  if (!canAccess(actor.role, "pengaturan_subscription")) {
    throw new Error("Hanya Master Admin atau Admin yang dapat memilih paket");
  }
  if (!packageId) {
    throw new Error("Package id is required");
  }

  const { data, error } = await actor.supabase.rpc("platform_create_billing_invoice", {
    target_organization_id: actor.orgId,
    target_package_id: packageId,
    invoice_type: "upgrade",
  });
  if (error) throw error;

  revalidatePath("/app/pengaturan/subscription");
  return { invoiceId: data as string };
}
