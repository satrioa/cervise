"use client";

import Link from "next/link";
import { ArrowRightIcon, MessageCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  wa_confirmation_sent_at?: string | null;
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

/**
 * Ringkasan singkat di halaman pemakaian. Pembelian, transfer, dan unggah bukti
 * sekarang berada di halaman tersendiri: /app/pengaturan/usage/beli.
 */
export function WaTopupPanel({
  invoices,
  proofs,
  ledger,
}: {
  packages?: TopupPackageItem[];
  invoices: TopupInvoice[];
  proofs: ProofItem[];
  ledger?: LedgerItem[];
  branches?: { id: string; name: string }[];
  branchUsage?: { branch_id: string | null; units: number }[];
}) {
  const recent = invoices.slice(0, 3);
  const topupBalance = (ledger ?? [])
    .filter((item) => item.description?.toLowerCase().includes("top-up"))
    .reduce((total, item) => total + item.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kuota WhatsApp tambahan</CardTitle>
        <CardDescription>
          Beli pesan tambahan untuk seluruh cabang. Transfer &amp; unggah bukti dilakukan di halaman terpisah.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topupBalance > 0 ? (
          <p className="text-sm text-muted-foreground">
            Sisa kuota top-up: <span className="font-mono font-medium text-foreground">{topupBalance.toLocaleString("id-ID")} pesan</span>
          </p>
        ) : null}
        <Button asChild>
          <Link href="/app/pengaturan/usage/beli">
            <MessageCircleIcon className="size-4" /> Beli kuota WhatsApp <ArrowRightIcon className="size-4" />
          </Link>
        </Button>

        {recent.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Order terakhir</p>
            {recent.map((invoice) => {
              const hasProof = proofs.some((proof) => proof.invoice_id === invoice.id);
              return (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
                  <div>
                    <div className="font-mono font-medium">{invoice.invoice_number}</div>
                    <div className="text-muted-foreground">
                      {invoice.wa_message_quantity?.toLocaleString("id-ID") ?? 0} pesan · {formatRupiah(invoice.amount)} · {tanggal(invoice.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={invoice.status === "approved" ? "success" : invoice.status === "rejected" ? "destructive" : "warning"}>
                      {invoice.status === "approved" ? "Lunas" : invoice.status === "rejected" ? "Ditolak" : "Menunggu verifikasi"}
                    </Badge>
                    {hasProof ? <Badge variant="outline">Bukti diunggah</Badge> : null}
                    {invoice.wa_confirmation_sent_at ? <Badge variant="outline">WA terkirim</Badge> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
