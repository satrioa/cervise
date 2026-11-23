"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustTenantWaQuota, retryPaymentFulfillment } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { walletSummary } from "@/lib/payments/quota";

export type WalletRow = {
  organization_id: string;
  included_limit: number;
  included_used: number;
  topup_balance: number;
  period_start: string;
  period_end: string;
} | null;

export type BranchUsage = { branch_id: string | null; units: number };
export type LedgerRow = {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  reason: string | null;
  created_at: string;
};
export type FulfillmentRow = {
  id: string;
  invoice_id: string;
  fulfillment_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

const tanggal = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));

export function TenantWaQuotaPanel({
  organizationId,
  wallet,
  branchUsage,
  ledger,
  fulfillments,
  branches,
}: {
  organizationId: string;
  wallet: WalletRow;
  branchUsage: BranchUsage[];
  ledger: LedgerRow[];
  fulfillments: FulfillmentRow[];
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const summary = walletSummary(wallet);
  const branchName = (id: string | null) =>
    id ? (branches.find((branch) => branch.id === id)?.name ?? id.slice(0, 8)) : "Tanpa cabang";

  const refresh = () => {
    playPageTransition();
    router.refresh();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adjustTenantWaQuota(organizationId, Number(amount), reason);
      toast.success("Saldo top-up disesuaikan");
      setAmount("");
      setReason("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyesuaikan saldo");
    } finally {
      setSaving(false);
    }
  };

  const retry = (invoiceId: string) => {
    startTransition(async () => {
      try {
        await retryPaymentFulfillment(invoiceId);
        toast.success("Fulfillment dicoba ulang");
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal retry fulfillment");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp &amp; pembayaran</CardTitle>
        <CardDescription>
          Wallet shared lintas cabang. Included di-reset tiap periode; top-up tidak ikut ter-reset.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Included</div>
            <div className="mt-1 font-heading text-xl tabular-nums">{summary.included.toLocaleString("id-ID")}</div>
            <div className="text-xs text-muted-foreground">{summary.used.toLocaleString("id-ID")} terpakai</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Sisa included</div>
            <div className="mt-1 font-heading text-xl tabular-nums">{summary.remainingIncluded.toLocaleString("id-ID")}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Top-up</div>
            <div className="mt-1 font-heading text-xl tabular-nums">{summary.topup.toLocaleString("id-ID")}</div>
            <div className="text-xs text-muted-foreground">pesan</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Total tersedia</div>
            <div className="mt-1 font-heading text-xl tabular-nums">{summary.totalAvailable.toLocaleString("id-ID")}</div>
            <div className="text-xs text-muted-foreground">
              {summary.periodStart ? `${tanggal(summary.periodStart)} — ${tanggal(summary.periodEnd!)}` : "—"}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Pemakaian per cabang</div>
          <div className="flex flex-col gap-2">
            {branchUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pesan terkirim pada periode ini.</p>
            ) : (
              branchUsage.map((item) => (
                <div key={item.branch_id ?? "none"} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{branchName(item.branch_id)}</span>
                  <Badge variant="secondary" className="font-mono">{item.units} pesan</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Fulfillment pembayaran</div>
          {fulfillments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada fulfillment.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Invoice</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {fulfillments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.invoice_id.slice(0, 8)}</TableCell>
                      <TableCell>{item.fulfillment_type}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "succeeded" ? "success" : item.status === "failed" ? "destructive" : "warning"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status !== "succeeded" ? (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => retry(item.invoice_id)}>
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Riwayat kuota</div>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi kuota.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ledger.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
                  <span className="font-medium">{item.transaction_type}</span>
                  <span className="text-muted-foreground">{item.description}</span>
                  <span className="font-mono tabular-nums">{item.amount > 0 ? "+" : ""}{item.amount}</span>
                  {item.reason ? <span className="w-full text-muted-foreground">Alasan: {item.reason}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-[1fr_2fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quota-amount">Delta pesan (+/-)</Label>
            <Input id="quota-amount" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quota-reason">Alasan (wajib, tercatat)</Label>
            <Input id="quota-reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kompensasi gangguan pengiriman" />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={saving} className="w-full">Sesuaikan</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
