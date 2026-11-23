import { getTenantBilling } from "@/app/app/pengaturan/subscription/actions";
import { TenantBillingView } from "@/components/billing/tenant-billing-view";
import { getTrialDays } from "@/lib/pricing/public";

export async function SettingsBillingShowcasePage() {
  const [data, trialDays] = await Promise.all([getTenantBilling(), getTrialDays()]);
  return <TenantBillingView data={data} trialDays={trialDays} />;
}
