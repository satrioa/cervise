"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { approveInvoice, rejectInvoice } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  whatsapp_sent_at: string | null;
  decision_note: string | null;
  organization: { id: string; name: string } | null;
  package: { name: string } | null;
  currentPackageName: string | null;
  currentPackagePrice: number | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function statusVariant(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

export function InvoiceReviewTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const approve = async (invoice: InvoiceRow) => {
    const current = invoice.currentPackageName;
    const target = invoice.package?.name ?? null;
    const packageChanged = Boolean(current && target && current !== target);
    const isDowngrade =
      packageChanged &&
      invoice.currentPackagePrice !== null &&
      invoice.amount < invoice.currentPackagePrice;

    if (
      packageChanged &&
      !window.confirm(
        `${isDowngrade ? "DOWNGRADE" : "Perubahan paket"}: ${current} → ${target}.\n` +
          `Periode invoice ${formatDate(invoice.period_start)} — ${formatDate(invoice.period_end)}.\n` +
          "Approve akan mengganti paket tenant. Lanjut?",
      )
    ) {
      return;
    }

    setLoading(invoice.id);
    try {
      await approveInvoice({ invoiceId: invoice.id, note: "Pembayaran terverifikasi" });
      playPageTransition();
      toast.success(
        target ? `Invoice disetujui. Paket ${target} aktif.` : "Invoice disetujui dan paket diaktifkan",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyetujui invoice");
    } finally {
      setLoading(null);
    }
  };

  const reject = async (invoiceId: string) => {
    const reason = notes[invoiceId]?.trim() ?? "";
    if (reason.length < 3) {
      toast.error("Alasan rejection wajib diisi");
      return;
    }
    setLoading(invoiceId);
    try {
      await rejectInvoice({ invoiceId, reason });
      playPageTransition();
      toast.success("Invoice ditolak dan replacement dibuat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menolak invoice");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-medium">{invoice.invoice_number}</span><Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge><Badge variant="outline">{invoice.invoice_type}</Badge></div><div className="mt-1 text-sm">{invoice.organization?.name ?? "—"} · {invoice.package?.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground">{formatRupiah(invoice.amount)} · {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}{invoice.whatsapp_sent_at ? ` · WA dikirim ${formatDate(invoice.whatsapp_sent_at)}` : ""}</div>{invoice.decision_note ? <div className="mt-2 text-xs text-muted-foreground">Catatan: {invoice.decision_note}</div> : null}{invoice.status === "pending" ? <div className="mt-2 text-xs"><span className="text-muted-foreground">Approval: </span><span className="font-medium">{invoice.currentPackageName ?? "—"} → {invoice.package?.name ?? "—"}</span>{invoice.currentPackageName && invoice.package?.name && invoice.currentPackageName !== invoice.package.name && invoice.currentPackagePrice !== null && invoice.amount < invoice.currentPackagePrice ? <span className="ml-1 font-medium text-destructive">(downgrade)</span> : null}<span className="text-muted-foreground"> · periode {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}</span></div> : null}</div>
            {invoice.status === "pending" ? <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><Input className="min-w-56" placeholder="Alasan rejection" value={notes[invoice.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [invoice.id]: event.target.value }))} /><Button type="button" size="sm" loading={loading === invoice.id} onClick={() => approve(invoice)}><CheckIcon className="size-4" /> Setujui</Button><Button type="button" size="sm" variant="outline" disabled={loading === invoice.id} onClick={() => reject(invoice.id)}><XIcon className="size-4" /> Reject</Button></div> : null}
          </div>
        </div>
      ))}
      {invoices.length === 0 ? <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">Belum ada invoice.</div> : null}
    </div>
  );
}
