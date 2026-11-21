import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Reset kuota included sesuai periode tagihan. Top-up TIDAK ikut di-reset
 * (RPC wa_quota_reset sengaja tidak menyentuh topup_balance).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()));

  const { data: dueWallets, error: walletError } = await admin
    .from("whatsapp_quota_wallets")
    .select("organization_id, period_start, period_end")
    .lte("period_end", periodStart.toISOString().slice(0, 10));
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }

  let reset = 0;
  let failed = 0;
  for (const wallet of dueWallets ?? []) {
    const { data: subscription, error: subError } = await admin
      .from("tenant_subscriptions")
      .select("package_id, packages(whatsapp_quota)")
      .eq("organization_id", wallet.organization_id)
      .maybeSingle();
    if (subError) {
      failed += 1;
      continue;
    }
    const pkg = subscription?.packages as { whatsapp_quota: number } | { whatsapp_quota: number }[] | null | undefined;
    const quota = Array.isArray(pkg) ? (pkg[0]?.whatsapp_quota ?? 0) : (pkg?.whatsapp_quota ?? 0);

    const { error } = await admin.rpc("wa_quota_reset", {
      p_organization_id: wallet.organization_id,
      p_period_start: periodStart.toISOString().slice(0, 10),
      p_period_end: periodEnd.toISOString().slice(0, 10),
      p_included_limit: quota,
    });
    if (error) failed += 1;
    else reset += 1;
  }

  return NextResponse.json({ checked: dueWallets?.length ?? 0, reset, failed });
}
