"use client";

import { useState } from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updateTenantSubscription } from "@/app/owner/actions";
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
  const [status, setStatus] = useState(subscription?.status ?? "trial");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateTenantSubscription({ organizationId, packageId, customPrice, graceDays, status });
      toast.success("Subscription diperbarui");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui subscription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-1.5"><Label htmlFor="subscription-package">Paket</Label><select id="subscription-package" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={packageId} onChange={(event) => setPackageId(event.target.value)}>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · Rp{item.monthly_price.toLocaleString("id-ID")} · {item.branch_limit} branch</option>)}</select></div>
      <div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="subscription-custom-price">Custom price / bulan</Label><Input id="subscription-custom-price" type="number" min="0" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} placeholder="Kosongkan untuk harga package" /></div><div className="space-y-1.5"><Label htmlFor="subscription-grace">Grace days</Label><Input id="subscription-grace" type="number" min="0" max="30" value={graceDays} onChange={(event) => setGraceDays(event.target.value)} /></div></div>
      <div className="space-y-1.5"><Label htmlFor="subscription-status">Status</Label><select id="subscription-status" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>{["trial", "active", "grace", "blocked", "suspended", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan subscription</Button>
    </form>
  );
}
