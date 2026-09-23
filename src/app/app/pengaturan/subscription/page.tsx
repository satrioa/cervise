import { SettingsBillingShowcasePage } from "@/components/settings-billing";

export default function SubscriptionPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="px-6 py-2">
        <p className="text-xs text-muted-foreground">Harga dalam Rp — mengikuti pengaturan Lokalisasi (IDR). Untuk USD, ubah Currency di Lokalisasi.</p>
      </div>
      <SettingsBillingShowcasePage />
    </div>
  );
}
