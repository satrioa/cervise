"use client";

import { useState } from "react";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  Clock3Icon,
  FileTextIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtendSubscription } from "@/components/owner/extend-subscription";
import { SubscriptionForm } from "@/components/owner/subscription-form";
import { displayInvoiceStatus, licenseType } from "@/lib/billing/invoice-display";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BillingInvoice = {
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
};

export type BillingSubscription = {
  package_id: string;
  status: string;
  custom_monthly_price: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_days: number;
  package: { id: string; code: string; name: string; monthly_price: number; branch_limit: number } | null;
} | null;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function accessVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "info" as const;
  if (status === "grace") return "warning" as const;
  if (status === "blocked" || status === "suspended" || status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function TenantBillingDashboard({
  organizationId,
  subscription,
  invoices,
  packages,
  accessState,
  dbStatus,
  mismatch,
  graceEndsAt,
  nowIso,
}: {
  organizationId: string;
  subscription: BillingSubscription;
  invoices: BillingInvoice[];
  packages: { id: string; name: string; monthly_price: number; branch_limit: number }[];
  accessState: string;
  dbStatus: string | null;
  mismatch: boolean;
  graceEndsAt: string | null;
  nowIso: string;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const now = new Date(nowIso);
  const monthlyPrice = subscription?.custom_monthly_price ?? subscription?.package?.monthly_price ?? 0;
  const renewal =
    invoices.find((invoice) => invoice.status === "pending") ??
    invoices.find((invoice) => invoice.status === "approved") ??
    invoices[0] ??
    null;
  const renewalStatus = renewal ? displayInvoiceStatus(renewal, now) : null;
  const endDate = subscription?.status === "trial" ? subscription.trial_ends_at : subscription?.current_period_end ?? null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Billing &amp; subscription</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Status akses dihitung dari periode + grace, bukan hanya kolom status.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant={accessVariant(accessState)}>Akses: {accessState}</Badge>
          {mismatch ? <Badge variant="warning">DB: {dbStatus}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ringkasan paket — satu permukaan, bukan kartu bertumpuk. */}
        <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Paket saat ini</div>
              <div className="font-heading text-2xl font-semibold">{subscription?.package?.name ?? "Tanpa paket"}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5" /> {licenseType(subscription?.package?.code)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              {accessState === "blocked" ? (
                <span className="text-destructive">Akses terblokir sampai pembayaran dikonfirmasi.</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4" /> Layanan berjalan
                </span>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Harga / bulan" value={formatRupiah(monthlyPrice)} />
            <Field label={subscription?.status === "trial" ? "Trial berakhir" : "Akses s/d"} value={formatDate(endDate)} />
            <Field label="Periode mulai" value={formatDate(subscription?.current_period_start ?? null)} />
            <Field label="Grace berakhir" value={graceEndsAt ? formatDate(graceEndsAt) : "—"} />
            <Field label="Grace days" value={`${subscription?.grace_days ?? "—"}`} />
          </div>
        </div>

        {/* Invoice renewal — aksi utama. */}
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <FileTextIcon className="size-4 text-muted-foreground" /> Invoice renewal
          </div>
          <div className="rounded-xl border p-4 sm:p-5">
            {renewal && renewalStatus ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold">{renewal.invoice_number}</span>
                  <Badge variant={renewalStatus.variant}>{renewalStatus.label}</Badge>
                  <Badge variant="outline">{renewal.invoice_type}</Badge>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Jumlah" value={formatRupiah(renewal.amount)} />
                  <Field label="Periode tagihan" value={`${formatDate(renewal.period_start)} — ${formatDate(renewal.period_end)}`} />
                  <Field label="Jatuh tempo" value={formatDate(renewal.due_date)} />
                  <Field label="Status pembayaran" value={renewalStatus.paid ? "Lunas" : "Belum dibayar"} />
                </div>

                <button
                  type="button"
                  onClick={() => setDetailOpen((open) => !open)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={detailOpen}
                >
                  Detail
                  <ChevronDownIcon className={cn("size-4 transition-transform", detailOpen && "rotate-180")} />
                </button>
                {detailOpen ? (
                  <div className="mt-3 grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                    <Field label="Dikirim via WhatsApp" value={renewal.whatsapp_sent_at ? formatDate(renewal.whatsapp_sent_at) : "Belum"} />
                    <Field label="Catatan keputusan" value={renewal.decision_note ?? "—"} />
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
                  <ExtendSubscription
                    organizationId={organizationId}
                    subscription={subscription}
                    monthlyPrice={monthlyPrice}
                  />
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3Icon className="size-3.5" /> Perpanjangan hanya aktif setelah pembayaran dikonfirmasi.
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada invoice renewal untuk tenant ini.</p>
            )}
          </div>
        </div>

        {/* Riwayat invoice ringkas. */}
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarDaysIcon className="size-4 text-muted-foreground" /> Riwayat invoice
          </div>
          <div className="divide-y rounded-xl border">
            {invoices.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada invoice.</p>
            ) : (
              invoices.map((invoice) => {
                const status = displayInvoiceStatus(invoice, now);
                return (
                  <div key={invoice.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-medium">{invoice.invoice_number}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <span className="font-mono text-sm tabular-nums">{formatRupiah(invoice.amount)}</span>
                      <span className="text-xs text-muted-foreground">Dibayar {formatDate(invoice.whatsapp_sent_at)}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Form paket tetap tersedia. */}
        <div className="border-t pt-5">
          <SubscriptionForm
            organizationId={organizationId}
            subscription={subscription}
            packages={packages}
          />
        </div>
      </CardContent>
    </Card>
  );
}
