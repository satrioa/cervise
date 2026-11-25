"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CreditCardIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createCheckoutAction,
  createTopupOrderAction,
} from "@/app/app/pengaturan/usage/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";

type PackageItem = {
  id: string;
  code: string;
  name: string;
  message_quantity: number;
  price_idr: number;
};

type InvoiceItem = {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  wa_message_quantity: number;
  created_at: string;
};

type Order = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  quantity: number;
};

const STEPS = ["Pilih paket", "Pembayaran"] as const;

const tanggal = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));

export function TopupPurchaseFlow({
  packages,
  invoices,
}: {
  packages: PackageItem[];
  invoices: InvoiceItem[];
}) {
  const [step, setStep] = useState<number>(0);
  const [selected, setSelected] = useState<PackageItem | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const buy = (item: PackageItem) => {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createTopupOrderAction(item.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setSelected(item);
        setOrder({
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          amount: result.amount,
          quantity: result.quantity,
        });
        setStep(1);
        playPageTransition();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal membuat order");
      } finally {
        setBusy(false);
      }
    });
  };

  const pay = () => {
    if (!order) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createCheckoutAction(order.invoiceId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        window.location.assign(result.redirectUrl);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Pembayaran tidak dapat dimulai");
      } finally {
        setBusy(false);
      }
    });
  };

  const continueOrder = (invoice: InvoiceItem) => {
    const pkg = packages.find(
      (item) => item.message_quantity === invoice.wa_message_quantity && item.price_idr === invoice.amount,
    ) ?? packages[0];
    setSelected(pkg ?? null);
    setOrder({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: invoice.amount,
      quantity: invoice.wa_message_quantity,
    });
    setStep(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((label, index) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className={
                index <= step
                  ? "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                  : "flex size-5 items-center justify-center rounded-full border text-[10px] text-muted-foreground"
              }
            >
              {index < step ? <CheckIcon className="size-3" /> : index + 1}
            </span>
            <span className={index <= step ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {index < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
          </span>
        ))}
      </div>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilih paket</CardTitle>
            <CardDescription>Pesan tambahan shared untuk seluruh cabang dan tidak hangus saat kuota bulanan di-reset.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada paket top-up. Hubungi platform owner.</p>
            ) : (
              packages.map((item) => (
                <div key={item.id} className="flex flex-col rounded-xl border p-4">
                  <div className="font-heading text-lg font-semibold">{item.name}</div>
                  <div className="mt-1 font-mono text-2xl tabular-nums">{item.message_quantity.toLocaleString("id-ID")}</div>
                  <div className="text-xs text-muted-foreground">pesan WhatsApp</div>
                  <div className="mt-3 font-heading text-xl">{formatRupiah(item.price_idr)}</div>
                  <Button className="mt-4 w-full" disabled={busy} loading={busy && selected?.id === item.id} onClick={() => buy(item)}>
                    Beli kuota WhatsApp
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 1 && order ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pembayaran</CardTitle>
            <CardDescription>Pembayaran diverifikasi otomatis. Kuota aktif setelah pembayaran diterima.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Nominal pembayaran</div>
              <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">{formatRupiah(order.amount)}</div>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{order.invoiceNumber}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} loading={busy} onClick={pay}>
                <CreditCardIcon className="size-4" /> Bayar Sekarang
              </Button>
              <Button variant="ghost" onClick={() => setStep(0)}>Ganti paket</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anda akan diarahkan ke halaman pembayaran. Jangan tutup halaman ini sampai proses selesai.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {invoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order terakhir</CardTitle>
            <CardDescription>Status pembayaran diperbarui otomatis setelah konfirmasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="font-mono text-sm">{invoice.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {invoice.wa_message_quantity.toLocaleString("id-ID")} pesan · {formatRupiah(invoice.amount)} · {tanggal(invoice.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invoice.status === "approved" ? "success" : invoice.status === "rejected" ? "destructive" : "warning"}>
                    {invoice.status === "approved" ? "Lunas" : invoice.status === "rejected" ? "Ditolak" : "Menunggu pembayaran"}
                  </Badge>
                  {invoice.status === "pending" ? (
                    <Button size="sm" variant="ghost" onClick={() => continueOrder(invoice)}>
                      Lanjut bayar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
