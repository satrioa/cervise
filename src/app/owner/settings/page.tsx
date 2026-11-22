import { Settings2Icon } from "lucide-react";
import { getPlatformSettings } from "@/app/owner/actions";
import { SettingsForm } from "@/components/owner/settings-form";
import { PromoSettingsForm } from "@/components/owner/promo-settings-form";
import { IncidentForm } from "@/components/owner/incident-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopupPackageManager } from "@/components/owner/topup-package-manager";
import { PAYMENT_PROVIDERS } from "@/lib/payments/provider";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OwnerSettingsPage() {
  const [settings, topupResult] = await Promise.all([
    getPlatformSettings(),
    createAdminClient()
      .from("wa_topup_packages")
      .select("id, code, name, message_quantity, price_idr, is_active, sort_order")
      .order("sort_order", { ascending: true }),
  ]);
  const topupPackages = topupResult.data ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Settings2Icon className="size-3.5" /> Platform settings</div>
        <h1 className="mt-1 font-heading text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur pembayaran, paket top-up WhatsApp, renewal, grace period, kontak owner, dan Special Promo.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment providers</CardTitle>
          <CardDescription>Metode pembayaran yang tersedia untuk pembelian kuota dan perpanjangan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {PAYMENT_PROVIDERS.map((provider) => (
            <div key={provider.id} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{provider.label}</div>
                <p className="text-xs text-muted-foreground">{provider.notice}</p>
              </div>
              <Badge variant={provider.state === "active" ? "success" : "warning"} className="self-start sm:self-auto">
                {provider.state === "active" ? "ACTIVE" : "NOT CONFIGURED"}
              </Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Status pembayaran diverifikasi otomatis oleh sistem. Kuota dan langganan aktif setelah pembayaran diterima.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paket top-up WhatsApp</CardTitle>
          <CardDescription>Dijual per jumlah pesan dengan harga IDR. Shared untuk seluruh cabang tenant.</CardDescription>
        </CardHeader>
        <CardContent><TopupPackageManager packages={topupPackages as never} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Renewal defaults</CardTitle>
          <CardDescription>Perubahan berlaku untuk subscription lifecycle berikutnya.</CardDescription>
        </CardHeader>
        <CardContent><SettingsForm settings={settings} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Special Promo</CardTitle>
          <CardDescription>Atur durasi dan seluruh konten promo yang tampil di landing page.</CardDescription>
        </CardHeader>
        <CardContent>
          <PromoSettingsForm
            settings={{
              promo_title: settings.promo_title,
              promo_headline: settings.promo_headline,
              promo_subtext: settings.promo_subtext,
              promo_price: settings.promo_price,
              promo_included: settings.promo_included ?? [],
              promo_separate: settings.promo_separate ?? [],
              promo_note: settings.promo_note,
              promo_ends_at: settings.promo_ends_at,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catat insiden</CardTitle>
          <CardDescription>Insiden yang tercatat tampil di Uptime Card dashboard owner.</CardDescription>
        </CardHeader>
        <CardContent><IncidentForm /></CardContent>
      </Card>
    </div>
  );
}
