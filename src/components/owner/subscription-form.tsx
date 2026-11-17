"use client";

import { useState } from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { adjustTenantSubscription } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PackageOption = { id: string; name: string; monthly_price: number; branch_limit: number };
type Subscription = { package_id: string; custom_monthly_price: number | null; grace_days: number; status: string } | null;

export function SubscriptionForm({
  organizationId,
  subscription,
  packages,
}: {
  organizationId: string;
  subscription: Subscription;
  packages: PackageOption[];
}) {
  const [packageId, setPackageId] = useState(subscription?.package_id ?? packages[0]?.id ?? "");
  const [customPrice, setCustomPrice] = useState(subscription?.custom_monthly_price === null || !subscription ? "" : String(subscription.custom_monthly_price));
  const [graceDays, setGraceDays] = useState(String(subscription?.grace_days ?? 3));
  const [saving, setSaving] = useState(false);

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adjustTenantSubscription({ organizationId, packageId, customPrice, graceDays });
      playPageTransition();
      toast.success("Paket, harga, dan grace diperbarui");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui pengaturan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={saveSettings}>
      <div className="text-sm font-medium">Pengaturan langganan</div>
      <div className="space-y-1.5"><Label htmlFor="subscription-package">Paket</Label><select id="subscription-package" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={packageId} onChange={(event) => setPackageId(event.target.value)}>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · Rp{item.monthly_price.toLocaleString("id-ID")} · {item.branch_limit} branch</option>)}</select></div>
      <div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="subscription-custom-price">Custom price / bulan</Label><Input id="subscription-custom-price" type="number" min="0" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} placeholder="Kosongkan untuk harga package" /></div><div className="space-y-1.5"><Label htmlFor="subscription-grace">Grace days</Label><Input id="subscription-grace" type="number" min="0" max="30" value={graceDays} onChange={(event) => setGraceDays(event.target.value)} /></div></div>
      <p className="text-xs text-muted-foreground">Tidak mengubah periode atau status akses. Gunakan tombol Perpanjang untuk mengaktifkan masa aktif.</p>
      <Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan pengaturan</Button>
    </form>
  );
}
