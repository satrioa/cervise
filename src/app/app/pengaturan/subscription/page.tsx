import { SettingsBillingShowcasePage } from "@/components/settings-billing";
import { PageHeader } from "@/components/layout/page-header";

export default function SubscriptionPage() {
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
