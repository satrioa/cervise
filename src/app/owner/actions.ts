"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import {
  parseCreateTenantInput,
  parseInvoiceDecisionInput,
  parsePackageInput,
  parseTopupPackageInput,
} from "@/lib/platform/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserByEmail } from "@/lib/supabase/admin-users";
import { generateTempPassword } from "@/lib/auth/password";
import { buildOwnerAccountRows } from "@/lib/platform/owner-accounts";
import { resolveSubscriptionAccessState, type SubscriptionLifecycleStatus } from "@/lib/billing/renewal";
import { verifyMetaPhoneNumber } from "@/lib/meta-wa";
import { parsePromoList } from "@/lib/pricing/promo";
import {
  incidentServices,
  parseIncidentUpdates,
  revenueSeries,
  waSeries,
  waTotals,
  REVENUE_SEGMENTS,
  WA_SEGMENTS,
  type OwnerIncident,
} from "@/lib/owner/dashboard-widgets";

type PackageRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  branch_limit: number;
  is_active: boolean;
  sort_order: number;
  annual_price: number | null;
  trial_days: number | null;
  ticket_quota: number | null;
  whatsapp_quota: number | null;
  extra_branch_price: number | null;
  extra_ticket_block_price: number | null;
  ticket_block_size: number | null;
  wa_per_ticket_block: number | null;
  annual_multiplier: number | null;
  is_recommended: boolean;
};

type SubscriptionRow = {
  organization_id: string;
  package_id: string;
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
  currentPackageName: string | null;
  currentPackagePrice: number | null;
};

export async function getOwnerDashboard() {
  const { supabase } = await requirePlatformAdmin();
  const [organizationsResult, subscriptionsResult, branchesResult, invoicesResult, manualPaymentsResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, status, paket, owner_email, contact_phone, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenant_subscriptions")
        .select(
          "organization_id, package_id, status, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!inner(id, code, name, description, monthly_price, branch_limit, user_limit, is_active, sort_order)",
        ),
      supabase.from("branches").select("organization_id, is_active"),
      supabase
        .from("invoices")
        .select("id, organization_id, status, amount, invoice_type, period_start, period_end")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("manual_subscription_payments").select("amount"),
    ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  if (manualPaymentsResult.error) throw manualPaymentsResult.error;

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
    period_start: string | null;
    invoice_type: string | null;
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
    const subscriptionStatus = subscription?.status ?? organization.status;
    const accessState = resolveSubscriptionAccessState({
      status: subscriptionStatus as SubscriptionLifecycleStatus,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      graceDays: subscription?.grace_days ?? 0,
      now: new Date(),
    });

    return {
      ...organization,
      package: subscription?.package ?? null,
      subscriptionStatus,
      accessState,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      graceEndsAt: subscription?.current_period_end
        ? new Date(
            new Date(subscription.current_period_end).getTime() +
              (subscription.grace_days ?? 0) * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      graceDays: subscription?.grace_days ?? 0,
      effectivePrice,
      activeBranchCount: branchCounts.get(organization.id) ?? 0,
      pendingInvoices: invoices.filter(
        (invoice) => invoice.organization_id === organization.id && invoice.status === "pending",
      ).length,
    };
  });

  const admin = createAdminClient();
  const since180 = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const [outboxResult, incidentsResult, metricsResult] = await Promise.all([
    admin
      .from("cervise_notification_outbox")
      .select("created_at,to_kind,state")
      .gte("created_at", since180)
      .limit(20_000),
    admin
      .from("platform_incidents")
      .select("occurred_on,service,status,minutes,title,updates")
      .gte("occurred_on", since180.slice(0, 10))
      .order("occurred_on", { ascending: true })
      .limit(2_000),
    admin.rpc("owner_platform_metrics"),
  ]);
  if (outboxResult.error) throw outboxResult.error;
  if (incidentsResult.error) throw incidentsResult.error;
  if (metricsResult.error) throw metricsResult.error;

  const outboxRows = (outboxResult.data ?? []) as { created_at: string; to_kind: string | null; state: string }[];
  const incidents = (incidentsResult.data ?? []) as OwnerIncident[];
  const metrics = (metricsResult.data ?? {}) as {
    storage?: { bucket: string; objects: number; bytes: number }[];
    db_bytes?: number;
    users?: number;
  };

  const packageByOrg = new Map(tenants.map((tenant) => [tenant.id, tenant.package?.name ?? "Lainnya"]));
  const byPackage = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.status !== "approved") continue;
    const name = packageByOrg.get(invoice.organization_id) ?? "Lainnya";
    byPackage.set(name, (byPackage.get(name) ?? 0) + Number(invoice.amount ?? 0));
  }

  return {
    tenants,
    stats: {
      total: tenants.length,
      trial: tenants.filter((tenant) => tenant.accessState === "trial").length,
      active: tenants.filter((tenant) => tenant.accessState === "active").length,
      grace: tenants.filter((tenant) => tenant.accessState === "grace").length,
      blocked: tenants.filter((tenant) => tenant.accessState === "blocked").length,
      pendingInvoices: invoices.filter((invoice) => invoice.status === "pending").length,
      collected:
        invoices
          .filter((invoice) => invoice.status === "approved")
          .reduce((total, invoice) => total + invoice.amount, 0) +
        (manualPaymentsResult.data ?? []).reduce((total, payment) => total + payment.amount, 0),
    },
    widgets: {
      revenueSegments: [...REVENUE_SEGMENTS],
      revenueSeries: revenueSeries(invoices),
      revenueByPackage: [...byPackage].map(([name, amount]) => ({ name, amount })),
      waSegments: [...WA_SEGMENTS],
      waSeries: waSeries(outboxRows),
      waTotals: waTotals(outboxRows),
      uptimeServices: incidentServices(incidents),
      storage: metrics.storage ?? [],
      dbBytes: Number(metrics.db_bytes ?? 0),
      users: Number(metrics.users ?? 0),
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
    .select("id, code, name, description, monthly_price, branch_limit, is_active, sort_order, annual_price, trial_days, ticket_quota, whatsapp_quota, extra_branch_price, extra_ticket_block_price, ticket_block_size, wa_per_ticket_block, annual_multiplier, is_recommended")
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
  annualPrice?: string | number | null;
  trialDays?: string | number | null;
  ticketQuota?: string | number | null;
  whatsappQuota?: string | number | null;
  extraBranchPrice?: string | number | null;
  extraTicketBlockPrice?: string | number | null;
  ticketBlockSize?: string | number | null;
  waPerTicketBlock?: string | number | null;
  annualMultiplier?: string | number | null;
  isActive?: string | number | boolean;
  sortOrder?: string | number;
  isRecommended?: string | number | boolean;
}) {
  const { supabase } = await requirePlatformAdmin();
  const packageInput = parsePackageInput(input);
  const payload = {
    code: packageInput.code,
    name: packageInput.name,
    description: packageInput.description,
    monthly_price: packageInput.monthlyPrice,
    branch_limit: packageInput.branchLimit,
    annual_price: packageInput.annualPrice,
    trial_days: packageInput.trialDays,
    ticket_quota: packageInput.ticketQuota,
    whatsapp_quota: packageInput.whatsappQuota,
    extra_branch_price: packageInput.extraBranchPrice,
    extra_ticket_block_price: packageInput.extraTicketBlockPrice,
    ticket_block_size: packageInput.ticketBlockSize,
    wa_per_ticket_block: packageInput.waPerTicketBlock,
    annual_multiplier: packageInput.annualMultiplier,
    is_active: packageInput.isActive,
    sort_order: packageInput.sortOrder,
    is_recommended: packageInput.isRecommended,
  };

  const query = input.id
    ? supabase.from("packages").update(payload).eq("id", input.id)
    : supabase.from("packages").insert(payload);
  const { error } = await query;
  if (error) throw error;

  revalidatePath("/owner/packages");
  revalidatePath("/owner");
  revalidatePath("/");
  return { id: input.id ?? null };
}

export async function deletePackage(id: string) {
  const { supabase } = await requirePlatformAdmin();
  if (!id) throw new Error("ID paket tidak valid");

  // Paket yang sudah dipakai tidak boleh dihapus: FK ke tiga tabel ini
  // mengunci riwayat subscription & invoice tenant.
  const checks = await Promise.all([
    supabase.from("tenant_subscriptions").select("id", { count: "exact", head: true }).eq("package_id", id),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("package_id", id),
    supabase.from("manual_subscription_payments").select("id", { count: "exact", head: true }).eq("package_id", id),
  ]);
  for (const result of checks) {
    if (result.error) throw new Error(result.error.message);
  }
  const used = checks.reduce((total, result) => total + (result.count ?? 0), 0);
  if (used > 0) {
    throw new Error("Paket masih digunakan oleh subscription atau invoice. Nonaktifkan saja.");
  }

  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/owner/packages");
  revalidatePath("/owner");
  revalidatePath("/");
  return { ok: true };
}

export async function getInvoices() {
  const { supabase } = await requirePlatformAdmin();
  const [invoicesResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, organization_id, invoice_number, invoice_type, status, amount, period_start, period_end, due_date, whatsapp_sent_at, wa_confirmation_sent_at, decision_note, organization:organizations!inner(id, name), package:packages!inner(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tenant_subscriptions")
      .select("organization_id, custom_monthly_price, package:packages!inner(name, monthly_price)"),
  ]);
  if (invoicesResult.error) throw invoicesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const currentPackages = new Map(
    ((subscriptionsResult.data ?? []) as unknown as {
      organization_id: string;
      custom_monthly_price: number | null;
      package: { name: string; monthly_price: number } | { name: string; monthly_price: number }[] | null;
    }[]).map((subscription) => {
      const currentPackage = firstRelation(subscription.package);
      return [
        subscription.organization_id,
        {
          name: currentPackage?.name ?? null,
          price: subscription.custom_monthly_price ?? currentPackage?.monthly_price ?? null,
        },
      ];
    }),
  );

  const rows = (invoicesResult.data ?? []) as unknown as (Omit<
    InvoiceRow,
    "organization" | "package" | "currentPackageName" | "currentPackagePrice"
  > & {
    organization: { id: string; name: string } | { id: string; name: string }[] | null;
    package: { name: string } | { name: string }[] | null;
  })[];
  return rows.map((invoice) => {
    const currentPackage = currentPackages.get(invoice.organization_id);
    return {
      ...invoice,
      organization: firstRelation(invoice.organization),
      package: firstRelation(invoice.package),
      currentPackageName: currentPackage?.name ?? null,
      currentPackagePrice: currentPackage?.price ?? null,
    };
  }) as InvoiceRow[];
}

export async function getTenantDetail(organizationId: string) {
  const { supabase } = await requirePlatformAdmin();
  if (!organizationId) throw new Error("Tenant id is required");

  const [organizationResult, subscriptionResult, branchesResult, employeesResult, invoicesResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, status, paket, owner_email, owner_phone, contact_phone, meta_phone_number_id, created_at")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("tenant_subscriptions")
        .select(
          "id, package_id, status, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!inner(id, code, name, description, monthly_price, branch_limit, user_limit, is_active, sort_order)",
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

  const subscription = rawSubscription
    ? { ...rawSubscription, package: firstRelation(rawSubscription.package) }
    : null;

  return {
    organization: organizationResult.data,
    subscription,
    branches: branchesResult.data ?? [],
    employees: employeesResult.data ?? [],
    invoices: (invoicesResult.data ?? []).map((invoice) => ({
      ...invoice,
      currentPackageName: subscription?.package?.name ?? null,
      currentPackagePrice: subscription?.custom_monthly_price ?? subscription?.package?.monthly_price ?? null,
    })),
  };
}

/**
 * Nomor pengirim WhatsApp per tenant. Validasi ke Graph API supaya ID yang
 * salah tidak masuk ke database lalu baru gagal di antrean pengiriman.
 */
export async function updateTenantMetaPhoneNumber(input: {
  organizationId: string;
  phoneNumberId: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  if (!input.organizationId) throw new Error("Tenant id is required");

  const value = input.phoneNumberId.trim();
  let displayName: string | null = null;
  if (value) {
    if (!/^\d+$/.test(value)) {
      throw new Error("Phone number ID harus berisi angka saja");
    }
    displayName = await verifyMetaPhoneNumber(value);
  }

  const { error } = await supabase
    .from("organizations")
    .update({ meta_phone_number_id: value || null })
    .eq("id", input.organizationId);
  if (error) throw error;

  revalidatePath(`/owner/tenants/${input.organizationId}`);
  return { ok: true, displayName };
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
  const existing = await findAuthUserByEmail(admin, tenantInput.ownerEmail);

  let ownerId: string;
  let tempPassword: string | null = null;

  if (existing) {
    // Emailnya sudah punya akun. Password existing TIDAK diubah - diam-diam
    // menimpa password seseorang akan mengunci mereka dari akunnya sendiri.
    ownerId = existing.id;
  } else {
    // Dulu createUser dipanggil tanpa password sama sekali, jadi setiap owner
    // yang dibuat dari console ini punya akun yang mustahil login: aplikasi ini
    // tidak punya magic link, login murni password. Sekarang dibuat dengan
    // password sementara yang dikembalikan sekali ke pemanggil.
    const generated = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: tenantInput.ownerEmail,
      phone: tenantInput.ownerPhone,
      password: generated,
      email_confirm: true,
    });
    if (error) throw error;
    ownerId = data.user.id;
    tempPassword = generated;
  }

  const { data: organizationId, error } = await supabase.rpc("platform_create_tenant", {
    tenant_name: tenantInput.name,
    tenant_slug: tenantInput.slug,
    owner_user_id: ownerId,
    owner_email: tenantInput.ownerEmail,
    owner_phone: tenantInput.ownerPhone,
  });
  if (error) {
    // Tenant gagal dibuat. Kalau akun auth baru saja dibuat untuk ini, ikut
    // dibersihkan supaya tidak ada akun yatim tanpa tenant.
    if (tempPassword) await admin.auth.admin.deleteUser(ownerId);
    throw error;
  }

  // Akun owner yang BARU dibuat memakai password generated, jadi dashboard-nya
  // harus meminta password sendiri saat pertama masuk. Akun yang dipakai ulang
  // (tempPassword null) sengaja tidak disentuh: password-nya sudah dia punya.
  //
  // Kegagalan di sini tidak menggagalkan pembuatan tenant - tenantnya sudah
  // ada, dan melempar error hanya akan membuat operator mengulang dan mendapat
  // "email sudah terdaftar". Dicatat supaya tetap bisa ditelusuri.
  if (tempPassword) {
    const { error: flagError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", ownerId);
    if (flagError) {
      console.warn("gagal menandai must_change_password untuk owner", ownerId, flagError.message);
    }
  }

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  return {
    id: organizationId as string,
    ownerEmail: tenantInput.ownerEmail,
    // null = emailnya sudah punya akun, jadi password tidak diubah.
    tempPassword: tempPassword ?? undefined,
    reusedExistingAccount: !tempPassword,
  };
}

export async function archiveTenant(input: { organizationId: string; confirmName: string }) {
  const { supabase } = await requirePlatformAdmin();
  if (!input.organizationId) throw new Error("ID tenant tidak valid");

  const { data: organization, error: readError } = await supabase
    .from("organizations")
    .select("id, name, status")
    .eq("id", input.organizationId)
    .maybeSingle();
  if (readError) throw readError;
  if (!organization) throw new Error("Tenant tidak ditemukan");
  if (organization.status === "cancelled") throw new Error("Tenant sudah diarsipkan");
  if (input.confirmName.trim() !== organization.name.trim()) {
    throw new Error("Nama tenant tidak cocok");
  }

  // Soft delete: status cancelled langsung memblokir akses lewat
  // is_tenant_subscription_active(), tapi seluruh riwayat tetap tersimpan.
  // Role authenticated tidak punya grant UPDATE di organizations, jadi pakai
  // admin client — otorisasi sudah dicek requirePlatformAdmin() di atas.
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.organizationId);
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  revalidatePath(`/owner/tenants/${input.organizationId}`);
  return { ok: true };
}

export async function deleteTenantPermanently(input: { organizationId: string; confirmName: string }) {
  await requirePlatformAdmin();
  if (!input.organizationId) throw new Error("ID tenant tidak valid");

  // Role authenticated tidak punya grant DELETE di organizations — sama seperti
  // archiveTenant, otorisasi sudah dicek requirePlatformAdmin() di atas.
  const admin = createAdminClient();
  const { data: organization, error: readError } = await admin
    .from("organizations")
    .select("id, name, status")
    .eq("id", input.organizationId)
    .maybeSingle();
  if (readError) throw readError;
  if (!organization) throw new Error("Tenant tidak ditemukan");
  if (organization.status !== "cancelled") {
    throw new Error("Hanya tenant yang diarsipkan yang bisa dihapus permanen");
  }
  if (input.confirmName.trim() !== organization.name.trim()) {
    throw new Error("Nama tenant tidak cocok");
  }

  // FK cascade menghapus data tenant (invoice, subscription, staf, dll).
  // Akun auth owner sengaja tidak dihapus: email yang sama bisa dipakai tenant lain.
  const { error } = await admin.from("organizations").delete().eq("id", input.organizationId);
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  return { ok: true };
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

export async function extendTenantSubscription(input: {
  organizationId: string;
  packageId: string;
  customPrice: string | number | null;
  months: string | number;
  referenceNote: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  const customPrice =
    input.customPrice === null || input.customPrice === ""
      ? null
      : Number(input.customPrice);
  const months = Number(input.months);
  const referenceNote = input.referenceNote.trim();

  if (!input.packageId) throw new Error("Paket wajib dipilih");
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new Error("Durasi harus antara 1 dan 24 bulan");
  }
  if (customPrice !== null && (!Number.isInteger(customPrice) || customPrice < 0)) {
    throw new Error("Custom price must be zero or greater");
  }
  if (referenceNote.length < 3) {
    throw new Error("Catatan verifikasi WhatsApp wajib diisi");
  }

  const { error } = await supabase.rpc("platform_extend_subscription", {
    target_organization_id: input.organizationId,
    target_package_id: input.packageId,
    custom_monthly_price: customPrice,
    duration_months: months,
    reference_note: referenceNote,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tenants");
  revalidatePath(`/owner/tenants/${input.organizationId}`);
  revalidatePath("/app/pengaturan/subscription");
  return { ok: true };
}

export async function adjustTenantSubscription(input: {
  organizationId: string;
  packageId: string;
  customPrice: string | number | null;
  graceDays: string | number;
}) {
  const { supabase } = await requirePlatformAdmin();
  const customPrice =
    input.customPrice === null || input.customPrice === ""
      ? null
      : Number(input.customPrice);
  const graceDays = Number(input.graceDays);

  if (!input.packageId) throw new Error("Paket wajib dipilih");
  if (customPrice !== null && (!Number.isInteger(customPrice) || customPrice < 0)) {
    throw new Error("Custom price must be zero or greater");
  }
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) {
    throw new Error("Grace days must be between 0 and 30");
  }

  const { error } = await supabase.rpc("platform_adjust_subscription", {
    target_organization_id: input.organizationId,
    target_package_id: input.packageId,
    custom_monthly_price: customPrice,
    target_grace_days: graceDays,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/tenants");
  revalidatePath(`/owner/tenants/${input.organizationId}`);
  revalidatePath("/app/pengaturan/subscription");
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
    .select("renewal_lead_days, default_grace_days, owner_whatsapp, owner_email, bank_name, bank_account_name, bank_account_number, promo_title, promo_headline, promo_subtext, promo_price, promo_included, promo_separate, promo_note, promo_ends_at")
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
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
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
      bank_name: input.bankName.trim() || null,
      bank_account_name: input.bankAccountName.trim() || null,
      bank_account_number: input.bankAccountNumber.trim() || null,
    })
    .eq("id", true);
  if (error) throw error;

  revalidatePath("/owner/settings");
  return { ok: true };
}

export async function updatePromoSettings(input: {
  endsAtLocal: string;
  title: string;
  headline: string;
  subtext: string;
  price: string;
  included: string;
  separate: string;
  note: string;
}) {
  const { supabase } = await requirePlatformAdmin();
  const endsAt = new Date(input.endsAtLocal);
  if (Number.isNaN(endsAt.getTime())) throw new Error("Tanggal berakhir promo tidak valid");

  const included = parsePromoList(input.included);
  const separate = parsePromoList(input.separate);
  if (!included || !separate) throw new Error("Daftar poin promo tidak valid (maksimal 160 karakter per baris)");

  const title = input.title.trim();
  const headline = input.headline.trim();
  const price = input.price.trim();
  if (!title || !headline || !price) throw new Error("Judul, headline, dan harga wajib diisi");

  const { error } = await supabase
    .from("platform_settings")
    .update({
      promo_title: title.slice(0, 80),
      promo_headline: headline.slice(0, 120),
      promo_subtext: input.subtext.trim().slice(0, 240),
      promo_price: price.slice(0, 60),
      promo_included: included,
      promo_separate: separate,
      promo_note: input.note.trim().slice(0, 400),
      promo_ends_at: endsAt.toISOString(),
    })
    .eq("id", true);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/owner/settings");
  return { ok: true };
}

export async function createPlatformIncident(input: {
  occurredOn: string;
  service: string;
  status: string;
  minutes: string | number;
  title: string;
  updates: string;
}) {
  await requirePlatformAdmin();
  const occurredOn = new Date(`${input.occurredOn}T00:00:00Z`);
  if (Number.isNaN(occurredOn.getTime())) throw new Error("Tanggal insiden tidak valid");
  const minutes = Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("Durasi insiden harus 1–1440 menit");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Judul insiden wajib diisi");
  const updates = parseIncidentUpdates(input.updates);
  if (!updates) throw new Error("Format update harus HH:MM|Label|Catatan (opsional)");

  const { error } = await createAdminClient().from("platform_incidents").insert({
    occurred_on: occurredOn.toISOString().slice(0, 10),
    service: input.service,
    status: input.status,
    minutes,
    title,
    updates,
  });
  if (error) throw error;

  revalidatePath("/owner");
  revalidatePath("/owner/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paket top-up WhatsApp & penyesuaian kuota (Platform Owner)
// ---------------------------------------------------------------------------

export async function saveTopupPackage(input: {
  id?: string;
  code: string;
  name: string;
  messageQuantity: number | string;
  priceIdr: number | string;
  isActive?: boolean;
  sortOrder?: number | string;
}) {
  await requirePlatformAdmin();
  const value = parseTopupPackageInput(input);
  const admin = createAdminClient();
  const row = {
    code: value.code,
    name: value.name,
    message_quantity: value.messageQuantity,
    price_idr: value.priceIdr,
    is_active: value.isActive,
    sort_order: value.sortOrder,
  };

  if (value.id) {
    const { error } = await admin.from("wa_topup_packages").update(row).eq("id", value.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("wa_topup_packages").insert(row);
    if (error) throw error;
  }

  const actor = await admin.auth.getUser();
  await admin.from("platform_audit_logs").insert({
    actor_user_id: actor.data.user?.id ?? null,
    action: value.id ? "wa_topup_package.updated" : "wa_topup_package.created",
    entity_type: "wa_topup_package",
    entity_id: value.id ?? null,
    metadata: row as never,
  });

  revalidatePath("/owner/settings");
  revalidatePath("/app/pengaturan/usage");
  return { ok: true };
}

export async function setTopupPackageActive(id: string, isActive: boolean) {
  await requirePlatformAdmin();
  if (!id) throw new Error("ID paket tidak valid");
  const { error } = await createAdminClient()
    .from("wa_topup_packages")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/owner/settings");
  revalidatePath("/app/pengaturan/usage");
  return { ok: true };
}

export async function adjustTenantWaQuota(
  organizationId: string,
  amount: number,
  reason: string,
) {
  const { supabase } = await requirePlatformAdmin();
  if (!organizationId || !Number.isInteger(amount) || amount === 0) {
    throw new Error("Data penyesuaian tidak valid");
  }
  // auth.uid() diverifikasi RPC, jadi pakai client sesi owner.
  const { error } = await supabase.rpc("platform_adjust_wa_quota", {
    p_organization_id: organizationId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  revalidatePath(`/owner/tenants/${organizationId}`);
  revalidatePath("/app/pengaturan/usage");
  return { ok: true };
}

export async function retryPaymentFulfillment(invoiceId: string) {
  const { supabase } = await requirePlatformAdmin();
  if (!invoiceId) throw new Error("Invoice tidak valid");
  const { error } = await supabase.rpc("platform_retry_fulfillment", {
    p_invoice_id: invoiceId,
  });
  if (error) throw error;
  revalidatePath("/owner/billing");
  revalidatePath("/app/pengaturan/usage");
  return { ok: true };
}

export async function getOwnerProofUrl(storagePath: string) {
  await requirePlatformAdmin();
  const { getProofSignedUrl } = await import("@/lib/payments/payment-service");
  return getProofSignedUrl(storagePath);
}
