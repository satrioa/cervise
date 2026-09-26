"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import {
  parseCreateTenantInput,
  parseInvoiceDecisionInput,
  parsePackageInput,
} from "@/lib/platform/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOwnerAccountRows } from "@/lib/platform/owner-accounts";

type PackageRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  branch_limit: number;
  user_limit: number | null;
  is_active: boolean;
  sort_order: number;
};

type SubscriptionRow = {
  organization_id: string;
  status: string;
  custom_monthly_price: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_days: number;
  package: PackageRow | PackageRow[] | null;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  paket: string | null;
  owner_email: string | null;
  contact_phone: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  whatsapp_sent_at: string | null;
  decision_note: string | null;
  organization: { id: string; name: string } | null;
  package: { name: string } | null;
};

export async function getOwnerDashboard() {
  const { supabase } = await requirePlatformAdmin();
  const [organizationsResult, subscriptionsResult, branchesResult, invoicesResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, status, paket, owner_email, contact_phone, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenant_subscriptions")
        .select(
          "organization_id, status, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!inner(id, code, name, description, monthly_price, branch_limit, user_limit, is_active, sort_order)",
        ),
      supabase.from("branches").select("organization_id, is_active"),
      supabase
        .from("invoices")
        .select("id, organization_id, status, amount, invoice_type, period_start, period_end")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (invoicesResult.error) throw invoicesResult.error;

  const organizations = (organizationsResult.data ?? []) as OrganizationRow[];
  const subscriptions = ((subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]).map(
    (subscription) => ({
      ...subscription,
      package: firstRelation(subscription.package),
    }),
  ) as (Omit<SubscriptionRow, "package"> & { package: PackageRow | null })[];
  const branches = (branchesResult.data ?? []) as { organization_id: string; is_active: boolean }[];
  const invoices = (invoicesResult.data ?? []) as {
    organization_id: string;
    status: string;
    amount: number;
  }[];

  const subscriptionsByOrg = new Map(
    subscriptions.map((subscription) => [subscription.organization_id, subscription]),
  );
  const branchCounts = new Map<string, number>();
  for (const branch of branches) {
    if (branch.is_active) {
      branchCounts.set(
        branch.organization_id,
        (branchCounts.get(branch.organization_id) ?? 0) + 1,
      );
    }
  }

  const tenants = organizations.map((organization) => {
    const subscription = subscriptionsByOrg.get(organization.id) ?? null;
    const packagePrice = subscription?.package?.monthly_price ?? 0;
    const effectivePrice =
      subscription?.custom_monthly_price ?? packagePrice;

    return {
      ...organization,
      package: subscription?.package ?? null,
      subscriptionStatus: subscription?.status ?? organization.status,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      graceDays: subscription?.grace_days ?? 0,
      effectivePrice,
      activeBranchCount: branchCounts.get(organization.id) ?? 0,
      pendingInvoices: invoices.filter(
        (invoice) => invoice.organization_id === organization.id && invoice.status === "pending",
      ).length,
    };
  });

  return {
    tenants,
    stats: {
      total: tenants.length,
      trial: tenants.filter((tenant) => tenant.subscriptionStatus === "trial").length,
      active: tenants.filter((tenant) => tenant.subscriptionStatus === "active").length,
      grace: tenants.filter((tenant) => tenant.subscriptionStatus === "grace").length,
      blocked: tenants.filter((tenant) => tenant.subscriptionStatus === "blocked").length,
      pendingInvoices: invoices.filter((invoice) => invoice.status === "pending").length,
      collected: invoices
        .filter((invoice) => invoice.status === "approved")
        .reduce((total, invoice) => total + invoice.amount, 0),
    },
  };
}

export async function getTenants() {
  const dashboard = await getOwnerDashboard();
  return dashboard.tenants;
}

export async function getPackages() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from("packages")
    .select("id, code, name, description, monthly_price, branch_limit, user_limit, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PackageRow[];
}

export async function savePackage(input: {
  id?: string;
  code: string;
  name: string;
  description?: string;
  monthlyPrice: string | number;
  branchLimit: string | number;
  userLimit?: string | number | null;
}) {
  const { supabase } = await requirePlatformAdmin();
  const packageInput = parsePackageInput(input);
  const payload = {
    code: packageInput.code,
    name: packageInput.name,
    description: packageInput.description,
    monthly_price: packageInput.monthlyPrice,
    branch_limit: packageInput.branchLimit,
    user_limit: packageInput.userLimit,
  };

  const query = input.id
    ? supabase.from("packages").update(payload).eq("id", input.id)
    : supabase.from("packages").insert(payload);
  const { error } = await query;
  if (error) throw error;

  revalidatePath("/owner/packages");
  revalidatePath("/owner");
  return { id: input.id ?? null };
}

export async function getInvoices() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, organization_id, invoice_number, invoice_type, status, amount, period_start, period_end, due_date, whatsapp_sent_at, decision_note, organization:organizations!inner(id, name), package:packages!inner(name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<InvoiceRow, "organization" | "package"> & {
    organization: { id: string; name: string } | { id: string; name: string }[] | null;
    package: { name: string } | { name: string }[] | null;
  })[];
  return rows.map((invoice) => ({
    ...invoice,
    organization: firstRelation(invoice.organization),
    package: firstRelation(invoice.package),
  })) as InvoiceRow[];
}

export async function getTenantDetail(organizationId: string) {
  const { supabase } = await requirePlatformAdmin();
  if (!organizationId) throw new Error("Tenant id is required");

  const [organizationResult, subscriptionResult, branchesResult, employeesResult, invoicesResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, status, paket, owner_email, owner_phone, contact_phone, created_at")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("tenant_subscriptions")
        .select(
          "id, status, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!inner(id, code, name, description, monthly_price, branch_limit, user_limit, is_active, sort_order)",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("branches")
        .select("id, name, city, phone, is_active")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("employees")
        .select("id, profile_id, role, is_active, branch_id, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, status, amount, period_start, period_end, due_date, whatsapp_sent_at, decision_note")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
    ]);

  if (organizationResult.error) throw organizationResult.error;
  if (!organizationResult.data) throw new Error("Tenant not found");
  if (subscriptionResult.error) throw subscriptionResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (invoicesResult.error) throw invoicesResult.error;

  const rawSubscription = subscriptionResult.data as (Omit<SubscriptionRow, "organization_id" | "package"> & {
    package: PackageRow | PackageRow[] | null;
  }) | null;

  return {
    organization: organizationResult.data,
    subscription: rawSubscription
      ? { ...rawSubscription, package: firstRelation(rawSubscription.package) }
      : null,
    branches: branchesResult.data ?? [],
    employees: employeesResult.data ?? [],
    invoices: invoicesResult.data ?? [],
  };
}

export async function createTenant(input: {
  name: string;
  slug?: string;
  ownerEmail: string;
  ownerPhone: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  const tenantInput = parseCreateTenantInput(input);
  const admin = createAdminClient();
  const { data: userList, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  let owner = userList.users.find(
    (candidate) => candidate.email?.toLowerCase() === tenantInput.ownerEmail,
  );
  if (!owner) {
    const { data, error } = await admin.auth.admin.createUser({
      email: tenantInput.ownerEmail,
      phone: tenantInput.ownerPhone,
      email_confirm: true,
    });
    if (error) throw error;
    owner = data.user;
  }

  const { data: organizationId, error } = await supabase.rpc("platform_create_tenant", {
    tenant_name: tenantInput.name,
    tenant_slug: tenantInput.slug,
    owner_user_id: owner.id,
    owner_email: tenantInput.ownerEmail,
    owner_phone: tenantInput.ownerPhone,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  return { id: organizationId as string };
}

export async function approveInvoice(input: { invoiceId: string; note: string }) {
  const { supabase } = await requirePlatformAdmin();
  const decision = parseInvoiceDecisionInput(input.invoiceId, input.note);
  const { error } = await supabase.rpc("platform_approve_invoice", {
    target_invoice_id: decision.invoiceId,
    approval_note: decision.note,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tenants");
  revalidatePath("/app/pengaturan/subscription");
  return { ok: true };
}

export async function rejectInvoice(input: { invoiceId: string; reason: string }) {
  const { supabase } = await requirePlatformAdmin();
  const decision = parseInvoiceDecisionInput(input.invoiceId, input.reason);
  const { error } = await supabase.rpc("platform_reject_invoice", {
    target_invoice_id: decision.invoiceId,
    rejection_reason: decision.note,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tenants");
  return { ok: true };
}

export async function updateTenantSubscription(input: {
  organizationId: string;
  packageId: string;
  customPrice: string | number | null;
  graceDays: string | number;
  status: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  const customPrice =
    input.customPrice === null || input.customPrice === ""
      ? null
      : Number(input.customPrice);
  const graceDays = Number(input.graceDays);
  const status = input.status as
    | "trial"
    | "active"
    | "grace"
    | "blocked"
    | "suspended"
    | "cancelled";

  if (!Number.isInteger(customPrice) && customPrice !== null) {
    throw new Error("Custom price must be zero or greater");
  }
  if (customPrice !== null && customPrice < 0) {
    throw new Error("Custom price must be zero or greater");
  }
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) {
    throw new Error("Grace days must be between 0 and 30");
  }

  const { error } = await supabase.rpc("platform_update_subscription", {
    target_organization_id: input.organizationId,
    target_package_id: input.packageId,
    custom_monthly_price: customPrice,
    target_grace_days: graceDays,
    target_status: status,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  revalidatePath(`/owner/tenants/${input.organizationId}`);
  return { ok: true };
}

export async function getOwnerAccounts() {
  const { supabase } = await requirePlatformAdmin();
  const admin = createAdminClient();
  const perPage = 1000;
  const authUsersPromise = (async () => {
    const allUsers: User[] = [];
    for (let page = 1; ; page += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage });
      if (result.error) throw result.error;
      const pageUsers = result.data.users ?? [];
      allUsers.push(...pageUsers);
      if (pageUsers.length < perPage) break;
    }
    return allUsers;
  })();
  const [authUsers, profilesResult, employeesResult, organizationsResult, branchesResult, subscriptionsResult, platformAdminsResult] =
    await Promise.all([
      authUsersPromise,
      supabase.from("profiles").select("id, email, full_name, phone, is_active"),
      supabase.from("employees").select("id, profile_id, organization_id, branch_id, role, is_active"),
      supabase.from("organizations").select("id, name"),
      supabase.from("branches").select("id, name"),
      supabase.from("tenant_subscriptions").select("organization_id, status, package:packages!inner(name)"),
      supabase.from("platform_admins").select("profile_id, is_active"),
    ]);

  if (profilesResult.error) throw profilesResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (organizationsResult.error) throw organizationsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (platformAdminsResult.error) throw platformAdminsResult.error;

  const users = authUsers.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    metadataName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    confirmed: user.email ? Boolean(user.email_confirmed_at) : true,
    createdAt: user.created_at ?? new Date().toISOString(),
    lastSignInAt: user.last_sign_in_at ?? null,
  }));
  const profiles = ((profilesResult.data ?? []) as {
    id: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean;
  }[]).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    phone: profile.phone,
    active: profile.is_active,
  }));
  const employees = ((employeesResult.data ?? []) as {
    id: string;
    profile_id: string;
    organization_id: string;
    branch_id: string;
    role: string;
    is_active: boolean;
  }[]).map((employee) => ({
    id: employee.id,
    profileId: employee.profile_id,
    organizationId: employee.organization_id,
    branchId: employee.branch_id,
    role: employee.role,
    active: employee.is_active,
  }));
  const organizations = ((organizationsResult.data ?? []) as { id: string; name: string }[]).map((organization) => ({ id: organization.id, name: organization.name }));
  const branches = ((branchesResult.data ?? []) as { id: string; name: string }[]).map((branch) => ({ id: branch.id, name: branch.name }));
  const subscriptions = ((subscriptionsResult.data ?? []) as {
    organization_id: string;
    status: string;
    package: { name: string } | { name: string }[] | null;
  }[]).map((subscription) => ({
    organizationId: subscription.organization_id,
    status: subscription.status,
    packageName: Array.isArray(subscription.package) ? subscription.package[0]?.name ?? null : subscription.package?.name ?? null,
  }));
  const platformAdmins = ((platformAdminsResult.data ?? []) as { profile_id: string; is_active: boolean }[]).map((adminRow) => ({ profileId: adminRow.profile_id, active: adminRow.is_active }));

  return buildOwnerAccountRows({ users, profiles, employees, organizations, branches, subscriptions, platformAdmins });
}

export async function setEmployeeActive(input: { employeeId: string; active: boolean }) {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: input.active })
    .eq("id", input.employeeId);
  if (error) throw error;

  revalidatePath("/owner/accounts");
  revalidatePath("/owner/tenants");
  return { ok: true };
}

export async function getPlatformSettings() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("renewal_lead_days, default_grace_days, owner_whatsapp, owner_email")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlatformSettings(input: {
  renewalLeadDays: string | number;
  defaultGraceDays: string | number;
  ownerWhatsapp: string;
  ownerEmail: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  const renewalLeadDays = Number(input.renewalLeadDays);
  const defaultGraceDays = Number(input.defaultGraceDays);
  if (!Number.isInteger(renewalLeadDays) || renewalLeadDays < 1 || renewalLeadDays > 30) {
    throw new Error("Renewal lead days must be between 1 and 30");
  }
  if (!Number.isInteger(defaultGraceDays) || defaultGraceDays < 0 || defaultGraceDays > 30) {
    throw new Error("Default grace days must be between 0 and 30");
  }

  const { error } = await supabase
    .from("platform_settings")
    .update({
      renewal_lead_days: renewalLeadDays,
      default_grace_days: defaultGraceDays,
      owner_whatsapp: input.ownerWhatsapp.trim() || null,
      owner_email: input.ownerEmail.trim() || null,
    })
    .eq("id", true);
  if (error) throw error;

  revalidatePath("/owner/settings");
  return { ok: true };
}
