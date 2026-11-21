import { requireMenu } from "@/lib/auth/require-menu";
import { getActiveTenant } from "@/lib/supabase/actor";
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
  const [{ data: usage }, billing] = await Promise.all([
    actor.supabase.rpc("get_tenant_usage", { p_organization_id: actor.orgId }),
    getTenantBilling(),
  ]);
  return <UsagePage usage={(usage as Record<string, unknown> | null) ?? null} billing={billing} />;
}
