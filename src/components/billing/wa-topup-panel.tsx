"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createTopupOrderAction,
  getPaymentProofUrlAction,
  uploadPaymentProofAction,
} from "@/app/app/pengaturan/usage/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIVE_PAYMENT_PROVIDER, PAYMENT_PROVIDERS } from "@/lib/payments/provider";
import { formatRupiah } from "@/lib/format";

export type TopupPackageItem = {
  id: string;
  code: string;
  name: string;
  message_quantity: number;
  price_idr: number;
};
export type TopupInvoice = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  amount: number;
  wa_message_quantity: number | null;
  due_date: string;
  created_at: string;
};
export type ProofItem = {
  id: string;
  invoice_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
};
export type LedgerItem = {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  reason: string | null;
  created_at: string;
};

const tanggal = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));

export function WaTopupPanel({
  packages,
  invoices,
  proofs,
  ledger,
  branches,
  branchUsage,
}: {
  packages: TopupPackageItem[];
  invoices: TopupInvoice[];
  proofs: ProofItem[];
  ledger: LedgerItem[];
  branches: { id: string; name: string }[];
  branchUsage: { branch_id: string | null; units: number }[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    playPageTransition();
    router.refresh();
  };

  const buy = (packageId: string) => {
    setBusyId(packageId);
    startTransition(async () => {
      try {
        await createTopupOrderAction(packageId);
        toast.success("Order top-up dibuat. Unggah bukti transfer untuk diverifikasi owner.");
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal membuat order");
      } finally {
        setBusyId(null);
      }
    });
  };

  const upload = (invoiceId: string) => {
    if (!file) {
      toast.error("Pilih file bukti transfer terlebih dahulu");
      return;
    }
    setBusyId(invoiceId);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("invoiceId", invoiceId);
        data.set("file", file);
        await uploadPaymentProofAction(data);
        toast.success("Bukti diunggah. Menunggu verifikasi platform owner.");
        setFile(null);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengunggah bukti");
      } finally {
        setBusyId(null);
      }
    });
  };

  const openProof = (storagePath: string) => {
    startTransition(async () => {
      try {
        const url = await getPaymentProofUrlAction(storagePath);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else toast.error("Bukti tidak tersedia");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal membuka bukti");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beli pesan tambahan</CardTitle>
          <CardDescription>
            Top-up dijual per jumlah pesan, bukan saldo rupiah. Pesan shared untuk seluruh cabang dan tidak hangus saat kuota bulanan di-reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada paket top-up. Hubungi platform owner untuk menyiapkan paket.
              </p>
            ) : (
              packages.map((item) => (
                <div key={item.id} className="flex flex-col rounded-xl border p-4">
                  <div className="font-heading text-lg font-semibold">{item.name}</div>
                  <div className="mt-1 font-mono text-2xl tabular-nums">{item.message_quantity.toLocaleString("id-ID")}</div>
                  <div className="text-xs text-muted-foreground">pesan WhatsApp</div>
                  <div className="mt-3 font-heading text-xl">{formatRupiah(item.price_idr)}</div>
                  <Button className="mt-4 w-full" disabled={pending} loading={busyId === item.id} onClick={() => buy(item.id)}>
                    Beli top-up
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/8 p-3 text-xs">
            {PAYMENT_PROVIDERS.map((provider) => (
              <div key={provider.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{provider.label}:</span>
                <span className="text-muted-foreground">{provider.notice}</span>
              </div>
            ))}
            <p className="mt-1 text-muted-foreground">
              Transfer bank manual memerlukan verifikasi platform owner. Kuota hanya bertambah setelah pembayaran disetujui — mengunggah bukti tidak otomatis menambah kuota.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order top-up saya</CardTitle>
          <CardDescription>Transfer sesuai nominal invoice, lalu unggah bukti pembayaran.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proof-file">Bukti transfer (JPG/PNG/PDF, maks. 5 MB)</Label>
            <Input id="proof-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada order top-up.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.map((invoice) => {
                const proof = proofs.find((item) => item.invoice_id === invoice.id);
                return (
                  <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-mono text-sm font-medium">{invoice.invoice_number}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {invoice.wa_message_quantity?.toLocaleString("id-ID") ?? 0} pesan · {formatRupiah(invoice.amount)} · {tanggal(invoice.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={invoice.status === "approved" ? "success" : invoice.status === "rejected" ? "destructive" : "warning"}>
                        {invoice.status === "approved" ? "Lunas" : invoice.status === "rejected" ? "Ditolak" : "Menunggu verifikasi"}
                      </Badge>
                      {proof ? (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => openProof(proof.storage_path)}>Lihat bukti</Button>
                      ) : null}
                      {invoice.status === "pending" ? (
                        <Button size="sm" variant="outline" disabled={pending || !file} loading={busyId === invoice.id} onClick={() => upload(invoice.id)}>
                          Unggah bukti
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pemakaian &amp; riwayat kuota</CardTitle>
          <CardDescription>Semua cabang menarik dari satu wallet tenant yang sama.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {branchUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesan terkirim.</p>
          ) : (
            branchUsage.map((item) => {
              const name = item.branch_id
                ? (branches.find((branch) => branch.id === item.branch_id)?.name ?? item.branch_id.slice(0, 8))
                : "Tanpa cabang";
              return (
                <div key={item.branch_id ?? "none"} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{name}</span>
                  <span className="font-mono tabular-nums">{item.units} pesan</span>
                </div>
              );
            })
          )}
          {ledger.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{item.transaction_type} · {item.description}</span>
              <span className="font-mono tabular-nums">{item.amount > 0 ? "+" : ""}{item.amount}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Provider aktif saat ini: {ACTIVE_PAYMENT_PROVIDER.label}. Duitku belum tersedia.</p>
    </div>
  );
}
