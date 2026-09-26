"use client";

import { useEffect, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, DownloadIcon } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { getLaporanPenjualan } from "@/app/app/laporan/penjualan/actions";
import { toLocalDateString } from "@/lib/operational/garansi-list";
import type { LaporanPenjualan as SalesReport, SaleDetailRow } from "@/lib/operational/laporan-penjualan";

function formatHarian(iso: string) { return format(new Date(iso + "T12:00:00"), "EEEE, d MMMM yyyy", { locale: localeId }); }
function formatBulanan(iso: string) { return format(new Date(iso + "-01T12:00:00"), "MMMM yyyy", { locale: localeId }); }

function printHtml(title: string, rows: SaleDetailRow[]) {
  const omzet = rows.reduce((sum, row) => sum + row.total, 0);
  const paid = rows.reduce((sum, row) => sum + row.paid, 0);
  const unpaid = rows.reduce((sum, row) => sum + row.unpaid, 0);
  const detail = rows
    .map(
      (row, i) =>
        `<tr><td>${i + 1}</td><td style="font-family:monospace">${row.label}</td><td>${row.branchName}</td><td>${row.paymentMethod}</td><td>${row.paymentStatus}</td><td class="mono">${formatCurrencyPlain(row.total)}</td><td class="mono">${formatCurrencyPlain(row.paid)}</td><td class="mono">${formatCurrencyPlain(row.unpaid)}</td></tr>`,
    )
    .join("") || `<tr><td colspan="8" style="text-align:center;padding:16px;color:#6b7280">Tidak ada penjualan</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;padding:32px}table{width:100%;border-collapse:collapse}th{background:#111827;color:#fff;padding:8px}td{padding:8px;border-bottom:1px solid #eee} .mono{font-family:monospace}</style></head><body><h1>Cervise — ${title}</h1><table><thead><tr><th>Transaksi</th><th>Omzet</th><th>Dibayar</th><th>Belum dibayar</th></tr></thead><tbody><tr><td>${title}</td><td>${rows.length}</td><td class="mono">${formatCurrencyPlain(omzet)}</td><td class="mono">${formatCurrencyPlain(paid)}</td><td class="mono">${formatCurrencyPlain(unpaid)}</td></tr></tbody></table><h3>Detail</h3><table><thead><tr><th>No</th><th>Nota</th><th>Cabang</th><th>Metode</th><th>Status</th><th>Total</th><th>Dibayar</th><th>Belum dibayar</th></tr></thead><tbody>${detail}</tbody></table><script>window.print()</script></body></html>`;
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function LaporanPenjualanPage() {
  const [from, setFrom] = useState<Date | undefined>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [to, setTo] = useState<Date | undefined>(() => new Date());
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render when the range changes so the effect only fetches.
  const queryKey = `${from ? toLocalDateString(from) : ""}:${to ? toLocalDateString(to) : ""}`;
  const [loadedKey, setLoadedKey] = useState(queryKey);
  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setReport(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    const [fromDate, toDate] = queryKey.split(":");
    getLaporanPenjualan({ from: fromDate || undefined, to: toDate || undefined })
      .then((result) => {
        if (cancelled) return;
        if (result.error) setError(result.error);
        else setReport(result.data.report);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const harian = report?.harian ?? [];
  const bulanan = report?.bulanan ?? [];
  const summary = report?.summary;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Laporan Penjualan"
        titleClassName="font-heading text-2xl"
        description="Harian & Bulanan · terpisah dari Servis · stok per cabang"
        filters={
          <>
            <Popover><PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 w-auto shrink-0 justify-start font-normal" />}><CalendarIcon className="size-4 opacity-60" />{from ? format(from, "d MMM yyyy", { locale: localeId }) : "Tanggal awal"}</PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={from} onSelect={setFrom} /></PopoverContent></Popover>
            <Popover><PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 w-auto shrink-0 justify-start font-normal" />}><CalendarIcon className="size-4 opacity-60" />{to ? format(to, "d MMM yyyy", { locale: localeId }) : "Tanggal akhir"}</PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={to} onSelect={setTo} /></PopoverContent></Popover>
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">

        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Omzet", value: formatCurrencyPlain(summary.omzet), tone: "text-foreground" },
              { label: "Sudah dibayar", value: formatCurrencyPlain(summary.paid), tone: "text-emerald-600 dark:text-emerald-400" },
              { label: "Belum dibayar", value: formatCurrencyPlain(summary.unpaid), tone: summary.unpaid > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground" },
              { label: "Transaksi", value: formatNumberPlain(summary.count), tone: "text-foreground" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{card.label}</div>
                <div className={`mt-2 font-heading text-2xl tabular-nums ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader><CardTitle className="text-base">Laporan Harian</CardTitle><CardDescription>Per hari (kas_date)</CardDescription></CardHeader>
          <CardContent>
            {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div> : harian.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">{report?.sales.length === 0 ? "Belum ada penjualan pada periode ini" : "Tidak ada penjualan yang cocok"}</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead className="text-right">Transaksi</TableHead><TableHead className="text-right">Omzet</TableHead><TableHead className="text-right">Belum dibayar</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{harian.map((r) => (<TableRow key={r.key}><TableCell className="font-medium">{formatHarian(r.key)}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.count)}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.omzet)}</TableCell><TableCell className="text-right font-mono tabular-nums text-amber-600">{formatCurrencyPlain(r.unpaid)}</TableCell><TableCell><Button size="icon-sm" variant="ghost" aria-label={`Download ${r.key}`} onClick={() => openPrint(printHtml(formatHarian(r.key), r.sales))}><DownloadIcon className="size-4" /></Button></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Laporan Bulanan</CardTitle><CardDescription>Per bulan</CardDescription></CardHeader>
          <CardContent>
            {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div> : bulanan.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">{report?.sales.length === 0 ? "Belum ada penjualan pada periode ini" : "Tidak ada penjualan yang cocok"}</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Bulan</TableHead><TableHead className="text-right">Transaksi</TableHead><TableHead className="text-right">Omzet</TableHead><TableHead className="text-right">Belum dibayar</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{bulanan.map((r) => (<TableRow key={r.key}><TableCell className="font-medium">{formatBulanan(r.key)}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.count)}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.omzet)}</TableCell><TableCell className="text-right font-mono tabular-nums text-amber-600">{formatCurrencyPlain(r.unpaid)}</TableCell><TableCell><Button size="icon-sm" variant="ghost" aria-label={`Download ${r.key}`} onClick={() => openPrint(printHtml(formatBulanan(r.key), r.sales))}><DownloadIcon className="size-4" /></Button></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
