import { getTenantBilling } from "@/app/app/pengaturan/subscription/actions";
import { TenantBillingView } from "@/components/billing/tenant-billing-view";

export async function SettingsBillingShowcasePage() {
  const data = await getTenantBilling();
  return <TenantBillingView data={data} />;
}
