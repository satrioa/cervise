"use client";

import { useState } from "react";
import { ArrowUpRightIcon, CheckIcon, Clock3Icon, MessageCircleIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { requestPackage } from "@/app/app/pengaturan/subscription/actions";
import { buildRenewalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/billing/renewal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Package = { id: string; code: string; name: string; description: string | null; monthly_price: number; branch_limit: number; user_limit: number | null };
type Subscription = { id: string; status: string; custom_monthly_price: number | null; current_period_start: string | null; current_period_end: string | null; trial_ends_at: string | null; grace_days: number; package: Package | null } | null;
type Invoice = { id: string; invoice_number: string; invoice_type: string; status: string; amount: number; period_start: string; period_end: string; due_date: string; whatsapp_sent_at: string | null; decision_note: string | null; package: { name: string } | null };

type BillingData = {
  organizationId: string;
  role: string;
  subscription: Subscription;
  invoices: Invoice[];
  packages: Package[];
  contact: { owner_whatsapp: string | null; owner_email: string | null };
};

function formatRupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—";
}

function statusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "info" as const;
  if (status === "grace") return "warning" as const;
  if (status === "blocked" || status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

export function TenantBillingView({ data }: { data: BillingData }) {
  const router = useRouter();
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const currentPackage = data.subscription?.package;
  const effectivePrice = data.subscription?.custom_monthly_price ?? currentPackage?.monthly_price ?? 0;
  const pendingInvoice = data.invoices.find((invoice) => invoice.status === "pending");

  const renewalLink = data.contact.owner_whatsapp && pendingInvoice
    ? buildWhatsAppUrl(
        data.contact.owner_whatsapp,
        buildRenewalWhatsAppMessage({
          tenantName: "Tenant Cervise",
          tenantId: data.organizationId,
          packageName: pendingInvoice.package?.name ?? currentPackage?.name ?? "Paket Cervise",
          invoiceId: pendingInvoice.invoice_number,
          amount: pendingInvoice.amount,
          periodStart: new Date(pendingInvoice.period_start),
          periodEnd: new Date(pendingInvoice.period_end),
        }),
      )
    : null;

  const choosePackage = async (packageId: string) => {
    setLoadingPackage(packageId);
    try {
      await requestPackage(packageId);
      toast.success("Permintaan paket dibuat. Selesaikan pembayaran via WhatsApp.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat permintaan paket");
    } finally {
      setLoadingPackage(null);
    }
  };

  return <div className="space-y-6"><Card><CardHeader className="flex-row items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CardTitle className="text-base">Subscription</CardTitle><Badge variant={statusVariant(data.subscription?.status ?? "blocked")}>{data.subscription?.status ?? "blocked"}</Badge></div><CardDescription className="mt-1">Paket, periode, dan status renewal tenant Anda.</CardDescription></div><div className="text-right"><div className="font-heading text-2xl">{formatRupiah(effectivePrice)}</div><div className="text-xs text-muted-foreground">per bulan</div></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-3"><div><div className="text-xs text-muted-foreground">Paket</div><div className="mt-1 font-medium">{currentPackage?.name ?? "—"}</div></div><div><div className="text-xs text-muted-foreground">{data.subscription?.status === "trial" ? "Trial berakhir" : "Renewal berikutnya"}</div><div className="mt-1 font-medium">{formatDate(data.subscription?.status === "trial" ? data.subscription?.trial_ends_at ?? null : data.subscription?.current_period_end ?? null)}</div></div><div><div className="text-xs text-muted-foreground">Branch limit</div><div className="mt-1 font-medium">{currentPackage?.branch_limit ?? "—"} branch</div></div></div>{data.subscription?.status === "trial" ? <div className="mt-5 flex gap-2 rounded-lg bg-info/8 p-3 text-sm text-info-foreground"><Clock3Icon className="mt-0.5 size-4 shrink-0" /><span>Trial 14 hari tetap gratis. Pilih paket paid di bawah; paket baru aktif setelah admin memverifikasi pembayaran WhatsApp.</span></div> : null}{pendingInvoice ? <div className="mt-5 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">Invoice {pendingInvoice.invoice_number} menunggu pembayaran</div><div className="mt-1 text-xs text-muted-foreground">Transfer {formatRupiah(pendingInvoice.amount)} via WhatsApp, lalu kirim bukti kepada platform owner.</div></div>{renewalLink ? <Button render={<a href={renewalLink} target="_blank" rel="noreferrer" />}><MessageCircleIcon className="size-4" /> Bayar via WhatsApp</Button> : <span className="text-xs text-muted-foreground">Kontak WhatsApp owner belum dikonfigurasi.</span>}</div> : null}</CardContent></Card><div><div className="mb-3"><h2 className="font-heading text-xl">Pilih paket</h2><p className="text-sm text-muted-foreground">Permintaan paket membuat invoice baru. Renewal tetap H-7 dan diproses otomatis.</p></div><div className="grid gap-3 lg:grid-cols-3">{data.packages.map((item) => { const isCurrent = currentPackage?.id === item.id; return <Card key={item.id} className={isCurrent ? "border-primary" : undefined}><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{item.name}</CardTitle>{isCurrent ? <Badge variant="success">Paket saat ini</Badge> : null}</div><CardDescription className="mt-1">{item.description || "Paket Cervise"}</CardDescription></CardHeader><CardContent><div className="font-heading text-2xl">{formatRupiah(item.monthly_price)}<span className="font-sans text-xs font-normal text-muted-foreground"> / bulan</span></div><Separator className="my-4" /><ul className="space-y-2 text-sm"><li className="flex items-center gap-2"><CheckIcon className="size-4 text-emerald-600" /> {item.branch_limit} branch</li><li className="flex items-center gap-2"><CheckIcon className="size-4 text-emerald-600" /> {item.user_limit ?? "Unlimited"} user</li><li className="flex items-center gap-2"><ShieldCheckIcon className="size-4 text-emerald-600" /> Approval manual via WhatsApp</li></ul><Button className="mt-5 w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent || loadingPackage !== null} loading={loadingPackage === item.id} onClick={() => choosePackage(item.id)}>{isCurrent ? "Paket aktif" : "Pilih paket"}<ArrowUpRightIcon className="size-4" /></Button></CardContent></Card>; })}</div></div><Card><CardHeader><CardTitle className="text-base">Riwayat invoice</CardTitle><CardDescription>Semua nominal tersimpan sebagai snapshot dan tidak berubah saat harga package diperbarui.</CardDescription></CardHeader><CardContent><div className="space-y-2">{data.invoices.map((invoice) => <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-mono text-sm">{invoice.invoice_number}</span><Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{invoice.package?.name ?? "—"} · {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}</div></div><div className="font-medium tabular-nums">{formatRupiah(invoice.amount)}</div></div>)}{data.invoices.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Belum ada invoice.</div> : null}</div></CardContent></Card></div>;
}
