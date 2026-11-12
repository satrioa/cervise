"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { extendTenantSubscription } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { addCalendarMonths, getEffectiveMonthlyPrice } from "@/lib/billing/renewal";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PackageOption = { id: string; name: string; monthly_price: number; branch_limit: number };

type Subscription = {
  package_id: string;
  custom_monthly_price: number | null;
  current_period_end: string | null;
} | null;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}

const DURATIONS = [1, 3, 6, 12];

export function ExtendSubscription({
  organizationId,
  subscription,
  packages,
}: {
  organizationId: string;
  subscription: Subscription;
  packages: PackageOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [packageId, setPackageId] = useState(subscription?.package_id ?? packages[0]?.id ?? "");
  const [customPrice, setCustomPrice] = useState(
    subscription?.custom_monthly_price === null || !subscription ? "" : String(subscription.custom_monthly_price),
  );
  const [months, setMonths] = useState(1);
  const [referenceNote, setReferenceNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPackage = packages.find((item) => item.id === packageId) ?? null;
  const monthlyPrice = getEffectiveMonthlyPrice(
    selectedPackage?.monthly_price ?? 0,
    customPrice === "" ? null : Number(customPrice),
  );

  const now = new Date();
  const currentEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const startsAt = currentEnd && currentEnd > now ? currentEnd : now;
  const preview = {
    startsAt,
    endsAt: addCalendarMonths(startsAt, months),
    amount: monthlyPrice * months,
    joining: currentEnd !== null && currentEnd > now,
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await extendTenantSubscription({ organizationId, packageId, customPrice, months, referenceNote });
      playPageTransition();
      toast.success(`Diperpanjang s/d ${formatDate(preview.endsAt)} (${selectedPackage?.name ?? "paket"})`);
      setOpen(false);
      setReferenceNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperpanjang subscription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={packages.length === 0}>
        <CalendarPlusIcon className="size-4" /> Perpanjang
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-0 shadow-2xl">
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                <CalendarPlusIcon className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">Perpanjang masa aktif</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {preview.joining
                    ? "Sisa periode berjalan disambung, tidak hangus."
                    : "Periode baru dimulai hari ini."}
                </DialogPrimitive.Description>
              </div>
            </div>
            <form className="space-y-4 px-6 py-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="extend-package">Paket</Label>
                <select
                  id="extend-package"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                >
                  {packages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Rp{item.monthly_price.toLocaleString("id-ID")} · {item.branch_limit} branch
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="extend-price">Custom price / bulan</Label>
                  <Input
                    id="extend-price"
                    type="number"
                    min="0"
                    value={customPrice}
                    onChange={(event) => setCustomPrice(event.target.value)}
                    placeholder="Kosongkan untuk harga paket"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="extend-duration">Durasi</Label>
                  <select
                    id="extend-duration"
                    className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    value={months}
                    onChange={(event) => setMonths(Number(event.target.value))}
                  >
                    {DURATIONS.map((value) => (
                      <option key={value} value={value}>
                        {value} bulan
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="extend-note">Catatan verifikasi WhatsApp *</Label>
                <Input
                  id="extend-note"
                  value={referenceNote}
                  onChange={(event) => setReferenceNote(event.target.value)}
                  placeholder="mis. Transfer BCA 9 Nov, ref 1234"
                  maxLength={200}
                />
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Periode baru</span>
                  <span className="text-right font-medium">
                    {formatDate(preview.startsAt)} — {formatDate(preview.endsAt)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {formatRupiah(preview.amount)} ({months} × {formatRupiah(monthlyPrice)})
                  </span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span className="text-muted-foreground">Status setelah simpan</span>
                  <span className="font-medium">Aktif</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Invoice reminder renewal yang tercakup periode ini akan otomatis di-void agar tidak di-approve dua kali.
              </p>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Batal
                </Button>
                <Button type="submit" loading={saving} disabled={!packageId || monthlyPrice < 0}>
                  Perpanjang
                </Button>
              </div>
            </form>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
