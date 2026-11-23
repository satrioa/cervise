"use server";

import { getActiveTenantForBilling } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessActor } from "@/lib/rbac";
import {
  createCheckoutRedirect,
  readCheckoutConfig,
} from "@/lib/payments/online-checkout";

function requireSubscriptionAccess(actor: { role: string; permissions?: readonly string[] | null }) {
  if (!canAccessActor(actor, "pengaturan_subscription")) {
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
  package_id: string | null;
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
  package_id: string | null;
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
  const actor = await getActiveTenantForBilling();
  requireSubscriptionAccess(actor);
  const [subscriptionResult, invoiceResult, packageResult, contactResult] = await Promise.all([
    actor.supabase
      .from("tenant_subscriptions")
      .select(
        "id, status, package_id, custom_monthly_price, current_period_start, current_period_end, trial_ends_at, grace_days, package:packages!left(id, code, name, description, monthly_price, branch_limit, user_limit)",
      )
      .eq("organization_id", actor.orgId)
      .maybeSingle(),
    actor.supabase
      .from("invoices")
      .select("id, invoice_number, package_id, invoice_type, status, amount, period_start, period_end, due_date, whatsapp_sent_at, decision_note, package:packages!left(name)")
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
  const rawInvoices = (invoiceResult.data ?? []) as InvoiceShape[];

  // RLS packages_select hanya menampilkan paket is_active. Paket lama yang
  // masih dipakai subscription aktif (mis. `pro`) jadi tidak ikut di-join,
  // sehingga halaman billing menampilkan "Tanpa paket". Ambil paket tersebut
  // lewat admin client, dibatasi hanya id yang memang dirujuk tenant ini.
  const hiddenIds = new Set<string>();
  if (rawSubscription?.package_id && !firstRelation(rawSubscription.package)) {
    hiddenIds.add(rawSubscription.package_id);
  }
  for (const invoice of rawInvoices) {
    if (invoice.package_id && !firstRelation(invoice.package)) hiddenIds.add(invoice.package_id);
  }
  const hiddenPackages = new Map<string, PackageShape>();
  if (hiddenIds.size > 0) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("packages")
      .select("id, code, name, description, monthly_price, branch_limit, user_limit")
      .in("id", [...hiddenIds]);
    for (const row of (data ?? []) as PackageShape[]) hiddenPackages.set(row.id, row);
  }

  const subscription = rawSubscription
    ? {
        ...rawSubscription,
        package:
          firstRelation(rawSubscription.package) ??
          hiddenPackages.get(rawSubscription.package_id ?? "") ??
          null,
      }
    : null;
  const invoices = rawInvoices.map((invoice) => ({
    ...invoice,
    package:
      firstRelation(invoice.package) ??
      (invoice.package_id
        ? (() => {
            const found = hiddenPackages.get(invoice.package_id);
            return found ? { name: found.name } : null;
          })()
        : null),
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
  // `getActiveTenantForBilling`, bukan `Strict`: tenant yang trial-nya habis
  // harus tetap bisa membuat invoice. Aktivasi paketnya nanti dilakukan
  // platform owner lewat `approveInvoice`, yang tidak bergantung pada
  // status langganan tenant sama sekali.
  const actor = await getActiveTenantForBilling();
  if (!canAccessActor(actor, "pengaturan_subscription")) {
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

  return { invoiceId: data as string };
}

/** Membuat sesi checkout online untuk invoice paket yang masih pending. */
export async function createSubscriptionCheckoutAction(invoiceId: string) {
  const actor = await getActiveTenantForBilling();
  if (!canAccessActor(actor, "pengaturan_subscription")) {
    throw new Error("Role tidak diizinkan mengakses billing");
  }
  if (!invoiceId) throw new Error("Invoice tidak valid");

  const config = readCheckoutConfig();
  if (!config) throw new Error("Pembayaran online belum tersedia. Hubungi admin.");

  const admin = createAdminClient();
  const [{ data: invoice, error: invoiceError }, { data: profile }] = await Promise.all([
    admin
      .from("invoices")
      .select("id, invoice_number, amount, status, invoice_type, organization_id")
      .eq("id", invoiceId)
      .eq("organization_id", actor.orgId)
      .in("invoice_type", ["upgrade", "renewal"])
      .maybeSingle(),
    admin.from("profiles").select("full_name, email, phone").eq("id", actor.userId ?? "").maybeSingle(),
  ]);
  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error("Invoice paket tidak ditemukan");
  if (invoice.status !== "pending") throw new Error("Invoice sudah diproses");

  const redirectUrl = await createCheckoutRedirect(
    {
      orderId: invoice.invoice_number,
      grossAmount: invoice.amount,
      firstName: profile?.full_name ?? "Pelanggan Kaggo",
      email: profile?.email ?? "",
      phone: profile?.phone,
      returnPath: "/app/pengaturan/subscription",
    },
    config,
  );

  return { redirectUrl };
}
