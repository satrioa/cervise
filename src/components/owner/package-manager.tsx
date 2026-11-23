"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, SaveIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { deletePackage, savePackage } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PackageRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  branch_limit: number;
  is_active: boolean;
  sort_order: number;
  annual_price: number | null;
  trial_days: number | null;
  ticket_quota: number | null;
  whatsapp_quota: number | null;
  extra_branch_price: number | null;
  extra_ticket_block_price: number | null;
  ticket_block_size: number | null;
  wa_per_ticket_block: number | null;
  annual_multiplier: number | null;
  is_recommended: boolean;
};

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  branchLimit: string;
  trialDays: string;
  ticketQuota: string;
  whatsappQuota: string;
  extraBranchPrice: string;
  extraTicketBlockPrice: string;
  ticketBlockSize: string;
  waPerTicketBlock: string;
  annualMultiplier: string;
  sortOrder: string;
  isActive: boolean;
  isRecommended: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  description: "",
  monthlyPrice: "",
  annualPrice: "",
  branchLimit: "1",
  trialDays: "",
  ticketQuota: "100",
  whatsappQuota: "300",
  extraBranchPrice: "79000",
  extraTicketBlockPrice: "199000",
  ticketBlockSize: "100",
  waPerTicketBlock: "300",
  annualMultiplier: "10",
  sortOrder: "40",
  isActive: true,
  isRecommended: false,
};

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function formFromPackage(item: PackageRow): FormState {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description ?? "",
    monthlyPrice: String(item.monthly_price),
    annualPrice: item.annual_price === null ? "" : String(item.annual_price),
    branchLimit: String(item.branch_limit),
    trialDays: item.trial_days === null ? "" : String(item.trial_days),
    ticketQuota: item.ticket_quota === null ? "" : String(item.ticket_quota),
    whatsappQuota: item.whatsapp_quota === null ? "" : String(item.whatsapp_quota),
    extraBranchPrice: String(item.extra_branch_price ?? 79000),
    extraTicketBlockPrice: String(item.extra_ticket_block_price ?? 199000),
    ticketBlockSize: String(item.ticket_block_size ?? 100),
    waPerTicketBlock: String(item.wa_per_ticket_block ?? 300),
    annualMultiplier: String(item.annual_multiplier ?? 10),
    sortOrder: String(item.sort_order),
    isActive: item.is_active,
    isRecommended: item.is_recommended,
  };
}

export function PackageManager({ packages }: { packages: PackageRow[] }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<"standard" | "custom">("standard");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const custom = packages.find((item) => item.code === "custom");
  const isCustomForm = mode === "custom";

  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setForm(emptyForm);
    setMode("standard");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await savePackage({
        id: form.id,
        code: isCustomForm ? "custom" : form.code,
        name: form.name,
        description: form.description,
        monthlyPrice: form.monthlyPrice,
        annualPrice: isCustomForm ? null : form.annualPrice || null,
        branchLimit: form.branchLimit,
        trialDays: isCustomForm ? null : form.trialDays || null,
        ticketQuota: form.ticketQuota || null,
        whatsappQuota: form.whatsappQuota || null,
        extraBranchPrice: form.extraBranchPrice,
        extraTicketBlockPrice: form.extraTicketBlockPrice,
        ticketBlockSize: form.ticketBlockSize,
        waPerTicketBlock: form.waPerTicketBlock,
        annualMultiplier: form.annualMultiplier,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        isRecommended: form.isRecommended,
      });
      playPageTransition();
      router.refresh();
      toast.success(form.id ? "Paket diperbarui" : "Paket dibuat");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan paket");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: PackageRow) => {
    setMode("standard");
    setForm(formFromPackage(item));
  };

  const editCustom = () => {
    if (!custom) return;
    setMode("custom");
    setForm(formFromPackage(custom));
  };

  const remove = async (item: PackageRow) => {
    if (!window.confirm(`Hapus paket "${item.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(item.id);
    try {
      await deletePackage(item.id);
      playPageTransition();
      router.refresh();
      toast.success("Paket dihapus");
      if (form.id === item.id) reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus paket");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((item) => (
          <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{item.name}</span>
                <Badge variant={item.is_active ? "success" : "outline"}>
                  {item.is_active ? "aktif" : "arsip"}
                </Badge>
                {item.is_recommended ? <Badge variant="info">unggulan</Badge> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatRupiah(item.monthly_price)} / bulan
                {item.annual_price ? ` · ${formatRupiah(item.annual_price)} / tahun` : ""}
                {" · "}{item.branch_limit} cabang
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.ticket_quota ?? 0} tiket · {item.whatsapp_quota ?? 0} WA
                {item.trial_days ? ` · trial ${item.trial_days} hari` : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{item.description || "Tanpa deskripsi"}</div>
            </div>
            <div className="mt-auto flex items-center gap-2">
              {item.code === "custom" ? (
                <Button type="button" variant="outline" size="sm" onClick={editCustom}>
                  Atur Pay as You Grow
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => edit(item)}>
                  <PencilIcon className="size-3.5" /> Edit
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus ${item.name}`}
                disabled={deleting === item.id}
                onClick={() => void remove(item)}
              >
                <TrashIcon className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {packages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Belum ada paket.</div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isCustomForm
              ? "Atur Pay as You Grow"
              : form.id
                ? "Edit paket"
                : "Tambah paket"}
          </CardTitle>
          <CardDescription>
            {isCustomForm
              ? "Harga dasar, kapasitas, dan tarif tambahan di luar paket Business."
              : "Harga disimpan dalam Rupiah penuh."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            {!isCustomForm ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="package-code">Kode *</Label>
                  <Input id="package-code" value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="starter" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField id="package-annual" label="Harga / tahun" value={form.annualPrice} onChange={(v) => update("annualPrice", v)} />
                  <NumberField id="package-trial" label="Durasi trial (hari)" value={form.trialDays} onChange={(v) => update("trialDays", v)} min={1} />
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="package-name">Nama *</Label>
              <Input id="package-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder={isCustomForm ? "Pay as You Grow" : "Starter"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="package-description">Deskripsi</Label>
              <Input id="package-description" value={form.description} onChange={(event) => update("description", event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField id="package-price" label="Harga / bulan *" value={form.monthlyPrice} onChange={(v) => update("monthlyPrice", v)} />
              <NumberField id="package-branch" label="Batas cabang *" value={form.branchLimit} onChange={(v) => update("branchLimit", v)} min={1} />
              <div className="col-span-2 text-xs text-muted-foreground">
                Karyawan dan tiket servis tanpa batas. Batas cabang tetap mengikuti paket.
              </div>
              <NumberField id="package-wa" label="Shared WhatsApp Quota / tenant / periode" value={form.whatsappQuota} onChange={(v) => update("whatsappQuota", v)} />
              <NumberField id="package-order" label="Urutan tampil" value={form.sortOrder} onChange={(v) => update("sortOrder", v)} />
            </div>

            {isCustomForm ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-medium">Tarif tambahan</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField id="addon-branch" label="Per cabang tambahan" value={form.extraBranchPrice} onChange={(v) => update("extraBranchPrice", v)} />
                  <NumberField id="addon-annual" label="Faktor harga tahunan" value={form.annualMultiplier} onChange={(v) => update("annualMultiplier", v)} min={1} />
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="package-active">Paket aktif</Label>
              <Switch id="package-active" checked={form.isActive} onCheckedChange={(v) => update("isActive", v)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="package-recommended">Tandai sebagai rekomendasi</Label>
              <Switch id="package-recommended" checked={form.isRecommended} onCheckedChange={(v) => update("isRecommended", v)} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan</Button>
              <Button type="button" variant="outline" onClick={reset}>
                <PlusIcon className="size-4" /> Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
