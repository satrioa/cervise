import { requireMenu } from "@/lib/auth/require-menu";
import { SettingsBillingShowcasePage } from "@/components/settings-billing";
import { PageHeader } from "@/components/layout/page-header";

export default async function SubscriptionPage() {
  // Paket, harga, dan masa langganan milik pemilik tenant.
  await requireMenu("pengaturan_subscription");
  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Subscription"
        titleClassName="font-heading text-2xl"
        description="Harga dalam Rp — mengikuti pengaturan Lokalisasi (IDR). Untuk USD, ubah Currency di Lokalisasi."
        containerClassName="max-w-4xl"
      />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <SettingsBillingShowcasePage />
      </div>
    </div>
  );
}
