"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, MessageCircleIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createTopupOrderAction,
  markTopupWaSentAction,
  uploadPaymentProofAction,
} from "@/app/app/pengaturan/usage/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  wa_confirmation_sent_at: string | null;
  created_at: string;
};

type ProofItem = {
  id: string;
  invoice_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
};

type Order = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  quantity: number;
};

const STEPS = ["Pilih paket", "Transfer", "Bukti & konfirmasi"] as const;

const tanggal = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));

export function TopupPurchaseFlow({
  packages,
  bank,
  invoices,
  proofs,
  adminWhatsappConfigured,
}: {
  packages: PackageItem[];
  bank: { name: string; accountName: string; accountNumber: string };
  invoices: InvoiceItem[];
  proofs: ProofItem[];
  adminWhatsappConfigured: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [selected, setSelected] = useState<PackageItem | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [waSent, setWaSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = () => {
    playPageTransition();
    router.refresh();
  };

  const buy = (item: PackageItem) => {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createTopupOrderAction(item.id);
        setSelected(item);
        setOrder({
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          amount: result.amount,
          quantity: result.quantity,
        });
        setStep(1);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal membuat order");
      } finally {
        setBusy(false);
      }
    });
  };

  const upload = () => {
    if (!file || !order) {
      toast.error("Pilih file bukti transfer terlebih dahulu");
      return;
    }
    setBusy(true);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("invoiceId", order.invoiceId);
        data.set("file", file);
        await uploadPaymentProofAction(data);
        toast.success("Bukti diunggah. Menunggu verifikasi platform owner.");
        setFile(null);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengunggah bukti");
      } finally {
        setBusy(false);
      }
    });
  };

  const confirmTransfer = () => {
    if (!order || !selected) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await markTopupWaSentAction({
          invoiceId: order.invoiceId,
          packageName: selected.name,
        });
        setWaSent(true);
        window.open(result.waUrl, "_blank", "noopener,noreferrer");
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menyiapkan pesan WhatsApp");
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
    setStep(proofs.some((proof) => proof.invoice_id === invoice.id) ? 2 : 1);
  };

  const copyAccount = () => {
    if (!bank.accountNumber) return;
    void navigator.clipboard.writeText(bank.accountNumber);
    toast.success("Nomor rekening disalin");
  };

  const proofUploaded = Boolean(order && proofs.some((proof) => proof.invoice_id === order.invoiceId));
  const bankLengkap = Boolean(bank.name && bank.accountName && bank.accountNumber);

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
            <CardTitle className="text-base">Transfer ke rekening platform owner</CardTitle>
            <CardDescription>Transfer sesuai nominal di bawah, lalu lanjut untuk mengunggah bukti.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Nominal transfer</div>
              <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">{formatRupiah(order.amount)}</div>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{order.invoiceNumber}</div>
            </div>

            {bankLengkap ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bank.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nama rekening</span><span className="font-medium">{bank.accountName}</span></div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Nomor rekening</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{bank.accountNumber}</span>
                    <Button size="icon-sm" variant="ghost" onClick={copyAccount} aria-label="Salin nomor rekening">
                      <CopyIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-warning/10 p-3 text-xs text-muted-foreground">
                Rekening transfer belum diatur oleh platform owner. Hubungi admin sebelum melakukan transfer.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!bankLengkap} onClick={() => setStep(2)}>Sudah transfer, lanjut unggah bukti</Button>
              <Button variant="ghost" onClick={() => setStep(0)}>Ganti paket</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && order ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unggah bukti & konfirmasi</CardTitle>
            <CardDescription>Bukti transfer diverifikasi platform owner. Kuota bertambah setelah pembayaran disetujui.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span className="font-mono text-xs">{order.invoiceNumber}</span>
              <span className="font-medium">{formatRupiah(order.amount)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-proof">Bukti transfer (JPG/PNG/WEBP/PDF, maks. 5 MB)</Label>
              <Input
                id="topup-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!file || busy} loading={busy} onClick={upload}>
                <UploadIcon className="size-4" /> Unggah bukti
              </Button>
              <Button disabled={!proofUploaded || busy || !adminWhatsappConfigured} loading={busy} onClick={confirmTransfer}>
                <MessageCircleIcon className="size-4" /> Saya sudah transfer
              </Button>
            </div>
            {!proofUploaded ? (
              <p className="text-xs text-muted-foreground">Unggah bukti dulu untuk mengaktifkan tombol konfirmasi.</p>
            ) : null}
            {!adminWhatsappConfigured ? (
              <p className="text-xs text-destructive">Nomor WhatsApp admin belum diatur, konfirmasi tidak bisa dikirim.</p>
            ) : null}
            {waSent ? (
              <p className="rounded-lg bg-success/10 p-3 text-xs text-muted-foreground">
                Pesan konfirmasi sudah dibuka di WhatsApp. Bukti Anda sedang menunggu verifikasi owner.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {invoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order terakhir</CardTitle>
            <CardDescription>Lanjutkan order yang belum selesai atau lihat status verifikasinya.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.map((invoice) => {
              const hasProof = proofs.some((proof) => proof.invoice_id === invoice.id);
              return (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <div className="font-mono text-sm">{invoice.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {invoice.wa_message_quantity.toLocaleString("id-ID")} pesan · {formatRupiah(invoice.amount)} · {tanggal(invoice.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invoice.status === "approved" ? "success" : invoice.status === "rejected" ? "destructive" : "warning"}>
                      {invoice.status === "approved" ? "Lunas" : invoice.status === "rejected" ? "Ditolak" : "Menunggu verifikasi"}
                    </Badge>
                    {invoice.wa_confirmation_sent_at ? (
                      <Badge variant="outline">WA terkirim</Badge>
                    ) : null}
                    {invoice.status === "pending" ? (
                      <Button size="sm" variant="ghost" onClick={() => continueOrder(invoice)}>
                        {hasProof ? "Lanjut konfirmasi" : "Lanjut transfer"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
