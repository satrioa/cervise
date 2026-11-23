import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SATU-SATUNYA jalur reservasi/pemakaian kuota WA.
 * Semua pengirim keluar (dispatcher, webhook, cron, manual) wajib memakai ini.
 * RPC di database yang melakukan lock & deduction atomik — tidak ada logika
 * baca-lalu-update di sisi aplikasi.
 */

export type QuotaSource = "included" | "topup" | "none";

export type QuotaReservation = {
  allowed: boolean;
  already_accounted: boolean;
  quota_source: QuotaSource;
  reservation_id: string;
};

export type Wallet = {
  organization_id: string;
  included_limit: number;
  included_used: number;
  topup_balance: number;
  period_start: string;
  period_end: string;
};

function admin() {
  return createAdminClient();
}

export async function reserveQuota(input: {
  organizationId: string;
  branchId?: string | null;
  idempotencyKey: string;
  messageType: string;
}): Promise<QuotaReservation> {
  const { data, error } = await admin().rpc("wa_quota_reserve", {
    p_organization_id: input.organizationId,
    p_idempotency_key: input.idempotencyKey,
    p_message_type: input.messageType,
    p_branch_id: input.branchId ?? null,
  });
  if (error) throw error;
  return data as QuotaReservation;
}

export async function finalizeQuota(input: {
  idempotencyKey: string;
  providerMessageId?: string | null;
  status: string;
}): Promise<{ ok: boolean; refunded?: boolean; reason?: string }> {
  const { data, error } = await admin().rpc("wa_quota_finalize", {
    p_idempotency_key: input.idempotencyKey,
    p_provider_message_id: input.providerMessageId ?? null,
    p_status: input.status,
  });
  if (error) throw error;
  return data as { ok: boolean; refunded?: boolean; reason?: string };
}

export async function releaseQuota(idempotencyKey: string): Promise<void> {
  const { error } = await admin().rpc("wa_quota_release", {
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
}

/** Webhook membawa provider_message_id, bukan kunci internal kita. */
export async function findIdempotencyKeyByProviderMessage(
  providerMessageId: string,
): Promise<string | null> {
  const { data, error } = await admin()
    .from("whatsapp_usage_logs")
    .select("idempotency_key")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (error) throw error;
  return data?.idempotency_key ?? null;
}

export async function getWallet(organizationId: string): Promise<Wallet | null> {
  const { data, error } = await admin()
    .from("whatsapp_quota_wallets")
    .select("organization_id, included_limit, included_used, topup_balance, period_start, period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as Wallet | null) ?? null;
}

export function walletSummary(wallet: Wallet | null) {
  const included = wallet?.included_limit ?? 0;
  const used = wallet?.included_used ?? 0;
  const topup = wallet?.topup_balance ?? 0;
  const remainingIncluded = Math.max(0, included - used);
  return {
    included,
    used,
    remainingIncluded,
    topup,
    totalAvailable: remainingIncluded + topup,
    consumed: used,
    periodStart: wallet?.period_start ?? null,
    periodEnd: wallet?.period_end ?? null,
  };
}

export const WA_WARNING_THRESHOLDS = { warning: 80, critical: 90, exhausted: 100 } as const;

export function quotaLevel(included: number, used: number): "ok" | "warning" | "critical" | "exhausted" {
  if (included <= 0) return "exhausted";
  const pct = Math.round((used / included) * 100);
  if (pct >= WA_WARNING_THRESHOLDS.exhausted) return "exhausted";
  if (pct >= WA_WARNING_THRESHOLDS.critical) return "critical";
  if (pct >= WA_WARNING_THRESHOLDS.warning) return "warning";
  return "ok";
}
