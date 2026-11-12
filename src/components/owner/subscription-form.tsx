"use client";

import { useState } from "react";
import { SaveIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { adjustTenantSubscription, updateTenantSubscription } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PackageOption = { id: string; name: string; monthly_price: number; branch_limit: number };
type Subscription = { package_id: string; custom_monthly_price: number | null; grace_days: number; status: string } | null;

const LIFECYCLE_STATUSES = ["trial", "grace", "blocked", "suspended", "cancelled"] as const;

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
  const [status, setStatus] = useState(subscription?.status ?? "trial");
  const [saving, setSaving] = useState<"settings" | "status" | null>(null);

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("settings");
    try {
      await adjustTenantSubscription({ organizationId, packageId, customPrice, graceDays });
      playPageTransition();
      toast.success("Paket, harga, dan grace diperbarui");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui pengaturan");
    } finally {
      setSaving(null);
    }
  };

  const saveStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("status");
    try {
      await updateTenantSubscription({
        organizationId,
        packageId: subscription?.package_id ?? packageId,
        customPrice: subscription?.custom_monthly_price ?? null,
        graceDays: subscription?.grace_days ?? 3,
        status,
      });
      playPageTransition();
      toast.success(`Status akses diubah ke ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah status akses");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <form className="space-y-3" onSubmit={saveSettings}>
        <div className="text-sm font-medium">Paket, harga & grace</div>
        <div className="space-y-1.5"><Label htmlFor="subscription-package">Paket</Label><select id="subscription-package" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={packageId} onChange={(event) => setPackageId(event.target.value)}>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · Rp{item.monthly_price.toLocaleString("id-ID")} · {item.branch_limit} branch</option>)}</select></div>
        <div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="subscription-custom-price">Custom price / bulan</Label><Input id="subscription-custom-price" type="number" min="0" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} placeholder="Kosongkan untuk harga package" /></div><div className="space-y-1.5"><Label htmlFor="subscription-grace">Grace days</Label><Input id="subscription-grace" type="number" min="0" max="30" value={graceDays} onChange={(event) => setGraceDays(event.target.value)} /></div></div>
        <p className="text-xs text-muted-foreground">Tidak mengubah periode atau status akses. Gunakan tombol Perpanjang untuk mengaktifkan masa aktif.</p>
        <Button type="submit" loading={saving === "settings"}><SaveIcon className="size-4" /> Simpan pengaturan</Button>
      </form>

      <form className="space-y-3 border-t pt-5" onSubmit={saveStatus}>
        <div className="flex items-center gap-2 text-sm font-medium"><ShieldAlertIcon className="size-4" /> Status akses</div>
        <div className="space-y-1.5">
          <Label htmlFor="subscription-status">Lifecycle</Label>
          <select id="subscription-status" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active" disabled>active (gunakan Perpanjang)</option>
            {LIFECYCLE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Untuk mengaktifkan kembali tenant, pakai tombol Perpanjang. Opsi ini untuk menangguhkan atau memblokir akses.</p>
        <Button type="submit" variant="outline" loading={saving === "status"} disabled={subscription?.status === status}><ShieldAlertIcon className="size-4" /> Ubah status akses</Button>
      </form>
    </div>
  );
}
