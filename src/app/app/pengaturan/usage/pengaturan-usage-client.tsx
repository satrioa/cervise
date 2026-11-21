"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "@/components/ui/skeleton-shapes";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import {
  BillingOverview,
  type BillingInvoice,
  type InvoiceStatus,
} from "@/components/billing-overview";

type UsageData = {
  services_used: number;
  ticket_limit: number | null;
  wa_included_used: number;
  wa_included_limit: number | null;
  wa_topup_granted: number;
  wa_topup_used: number;
  period_start: string;
};

type BillingData = {
  subscription: {
    status: string;
    custom_monthly_price: number | null;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    package: {
      id: string;
      code: string;
      name: string;
      monthly_price: number;
      branch_limit: number;
      user_limit: number | null;
    } | null;
  } | null;
  invoices: {
    id: string;
    invoice_number: string;
    status: string;
    amount: number;
    period_start: string;
    period_end: string;
    due_date: string;
  }[];
  contact: { owner_whatsapp: string | null; owner_email: string | null };
};

const idDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(d);
};

function invoiceStatus(status: string): InvoiceStatus {
  if (status === "approved") return "paid";
  if (status === "pending") return "open";
  if (status === "rejected") return "failed";
  return "refunded";
}

export default function UsagePage({
  usage,
  billing,
}: {
  usage: UsageData | Record<string, unknown> | null;
  billing: BillingData;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("cervise_services").select("id,created_at,branch_id").order("created_at", { ascending: false }).limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const data = usage as UsageData | null;
  const sub = billing.subscription;
  const pkg = sub?.package ?? null;
  const price = sub?.custom_monthly_price ?? pkg?.monthly_price ?? 0;
  const pending = billing.invoices.find((inv) => inv.status === "pending") ?? null;

  const periodStart = sub?.current_period_start ?? data?.period_start ?? null;
  const periodEnd = sub?.current_period_end ?? null;
  const cycleLength = periodStart && periodEnd
    ? Math.max(1, Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86_400_000))
    : 30;
  const cycleDay = periodStart
    ? Math.min(cycleLength, Math.max(1, Math.ceil((Date.now() - new Date(periodStart).getTime()) / 86_400_000)))
    : 1;

  const branchUsed = useMemo(() => new Set(rows.map((r) => r.branch_id ?? "pusat")).size, [rows]);

  const invoices: BillingInvoice[] = billing.invoices.map((inv) => ({
    id: inv.invoice_number,
    date: idDate(inv.period_start),
    amount: inv.amount,
    status: invoiceStatus(inv.status),
  }));

  const note = billing.contact.owner_whatsapp
    ? `Transfer lalu kirim bukti ke WhatsApp ${billing.contact.owner_whatsapp}. Tagihan aktif setelah pembayaran diverifikasi platform owner.`
    : "Transfer lalu kirim bukti pembayaran ke platform owner. Tagihan aktif setelah pembayaran diverifikasi.";

  const last7 = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7)
      .reverse();
  }, [rows]);

  const branchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.branch_id ?? "pusat";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()) as [string, number][];
  }, [rows]);

  const includes = [
    pkg ? `Maksimal ${pkg.branch_limit} cabang` : null,
    pkg ? (pkg.user_limit ? `Maksimal ${pkg.user_limit} user` : "User tanpa batas") : null,
    `Periode tagihan ${sub?.status === "trial" ? "trial" : "bulanan"}`,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Usage & billing"
        titleClassName="font-heading text-2xl"
        description="Paket, kuota yang jelas, dan riwayat tagihan. Kuota dihitung dari pemakaian pada periode berjalan dan di-reset tiap awal periode."
        containerClassName="mx-auto max-w-[1100px]"
      />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8">
        <BillingOverview
          subtitle="Berikut paket Anda, pemakaian siklus ini, dan tagihan yang perlu dibayar."
          plan={{
            name: pkg?.name ?? "Tanpa paket",
            price,
            interval: "month",
            billed: sub?.status === "trial" ? "Trial" : "Bulanan",
            renewsOn: idDate(sub?.status === "trial" ? sub.trial_ends_at : sub?.current_period_end),
            seats: pkg?.branch_limit ?? null,
            seatsUsed: branchUsed,
            includes,
          }}
          next={{
            dueOn: idDate(pending?.due_date ?? sub?.current_period_end),
            lines: [
              {
                label: pending ? `Renewal ${pkg?.name ?? "paket"}` : "Estimasi renewal berikutnya",
                amount: pending?.amount ?? price,
              },
            ],
            cycleDay,
            cycleLength,
          }}
          paymentNote={note}
          usage={[
            {
              label: "Tiket servis",
              used: data?.services_used ?? 0,
              limit: data?.ticket_limit ?? null,
              unit: "tiket",
              note: "Jumlah servis yang dibuat pada periode ini. Batas mengikuti kuota tiket paket Anda.",
            },
            {
              label: "Pesan WhatsApp included",
              used: data?.wa_included_used ?? 0,
              limit: data?.wa_included_limit ?? null,
              unit: "pesan",
              note: "Pesan otomatis gratis yang sudah termasuk paket.",
            },
            {
              label: "Pesan WhatsApp top-up",
              used: data?.wa_topup_used ?? 0,
              limit: data?.wa_topup_granted ?? null,
              unit: "pesan",
              note: "Pesan tambahan yang dibeli terpisah dari paket.",
            },
          ]}
          invoices={invoices}
          onChangePlan={() => router.push("/app/pengaturan/subscription")}
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">7 hari terakhir</CardTitle>
              <CardDescription>Jumlah servis per tanggal</CardDescription>
            </CardHeader>
            <CardContent>
              {!loading && last7.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Belum ada data</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Grafik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRowsSkeleton cells={["text", "money", "progress"]} rows={7} />
                    ) : (
                      last7.map(([date, cnt]) => (
                        <TableRow key={date}>
                          <TableCell className="font-mono text-xs">{format(new Date(`${date}T12:00:00`), "EEEE, d MMM yyyy", { locale: localeId })}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{cnt}</TableCell>
                          <TableCell className="text-right">
                            <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-foreground/10">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (cnt / Math.max(1, Math.max(...last7.map(([, c]) => c)))) * 100)}%` }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per cabang</CardTitle>
              <CardDescription>Jumlah servis per cabang dari 200 data terakhir</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {loading ? (
                <ul aria-hidden className="flex flex-col gap-2">
                  {[0, 1, 2].map((row) => (
                    <li key={row} className="flex items-center justify-between rounded-lg border p-3">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </li>
                  ))}
                </ul>
              ) : branchCounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada cabang dengan servis</div>
              ) : (
                branchCounts.map(([branch, cnt]) => (
                  <div key={branch} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-mono text-xs">{branch.slice(0, 8)}</span>
                    <Badge variant="secondary" className="font-mono">{cnt} servis</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Butuh detail tagihan? <Link className="underline underline-offset-4" href="/app/pengaturan/subscription">Buka halaman Subscription</Link>.
        </p>
      </div>
    </div>
  );
}
