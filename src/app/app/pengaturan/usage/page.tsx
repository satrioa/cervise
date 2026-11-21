import { requireMenu } from "@/lib/auth/require-menu";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantBilling } from "../subscription/actions";
import UsagePage from "./pengaturan-usage-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 */
export default async function Page() {
  await requireMenu("pengaturan_usage");
  const actor = await getActiveTenant();
  const admin = createAdminClient();
  const [{ data: usage }, billing, walletResult, packagesResult, ledgerResult, usageResult, proofsResult, topupResult] =
    await Promise.all([
      actor.supabase.rpc("get_tenant_usage", { p_organization_id: actor.orgId }),
      getTenantBilling(),
      admin.from("whatsapp_quota_wallets")
        .select("organization_id, included_limit, included_used, topup_balance, period_start, period_end")
        .eq("organization_id", actor.orgId).maybeSingle(),
      admin.from("wa_topup_packages")
        .select("id, code, name, message_quantity, price_idr, is_active, sort_order")
        .eq("is_active", true).order("sort_order", { ascending: true }),
      admin.from("whatsapp_quota_ledger")
        .select("id, transaction_type, amount, description, reason, created_at")
        .eq("organization_id", actor.orgId).order("created_at", { ascending: false }).limit(10),
      admin.from("whatsapp_usage_logs")
        .select("branch_id, quota_units, created_at")
        .eq("organization_id", actor.orgId)
        .gte("created_at", new Date(Date.now() - 35 * 86_400_000).toISOString()),
      admin.from("payment_proofs")
        .select("id, invoice_id, storage_path, file_name, created_at")
        .eq("organization_id", actor.orgId).order("created_at", { ascending: false }).limit(20),
      admin.from("invoices")
        .select("id, invoice_number, invoice_type, status, amount, wa_message_quantity, due_date, created_at")
        .eq("organization_id", actor.orgId).eq("invoice_type", "topup")
        .order("created_at", { ascending: false }).limit(10),
    ]);

  return (
    <UsagePage
      usage={(usage as Record<string, unknown> | null) ?? null}
      billing={billing}
      wallet={walletResult.data as never}
      topupPackages={(packagesResult.data ?? []) as never}
      ledger={(ledgerResult.data ?? []) as never}
      branchUsage={Object.entries(
        (usageResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
          const key = row.branch_id ?? "none";
          acc[key] = (acc[key] ?? 0) + row.quota_units;
          return acc;
        }, {}),
      ).map(([branch_id, units]) => ({ branch_id: branch_id === "none" ? null : branch_id, units }))}
      proofs={(proofsResult.data ?? []) as never}
      topupInvoices={(topupResult.data ?? []) as never}
      branches={(billing as { branches?: { id: string; name: string }[] }).branches ?? []}
    />
  );
}
