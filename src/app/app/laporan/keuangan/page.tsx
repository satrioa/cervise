"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DownloadIcon, CalendarIcon, ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { getLaporanKeuangan } from "@/app/app/laporan/keuangan/actions";
import { toLocalDateString } from "@/lib/operational/garansi-list";
import type { FinanceTx } from "@/lib/operational/laporan-keuangan";

type Tx = FinanceTx;

const SLICE_COLORS = [
  "rgb(99 102 241)",
  "rgb(16 185 129)",
  "rgb(56 189 248)",
  "rgb(245 158 11)",
  "rgb(244 63 94)",
  "rgb(168 85 247)",
];

function formatHarian(iso: string) {
  return format(new Date(iso + "T12:00:00"), "EEEE, d MMMM yyyy", { locale: localeId });
}
function formatBulanan(iso: string) {
  const d = new Date(iso + "-01T12:00:00");
  return format(d, "MMMM yyyy", { locale: localeId });
}

function downloadPdfHarian(date: string, detailRows: Tx[], cabangLabel: string) {
  const title = formatHarian(date);
  const total = detailRows.length;
  const masuk = detailRows.filter((r) => r.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0);
  const keluar = detailRows.filter((r) => r.type === "pengeluaran").reduce((a, b) => a + Number(b.amount), 0);
  const net = masuk - keluar;
  const detailHtml =
    detailRows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.description ?? ""}</td><td>${r.type}</td><td style="font-family:monospace">${formatCurrencyPlain(Number(r.amount))}</td><td>${r.metode ?? "—"}</td><td>${new Date(r.kas_date).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#6b7280">Tidak ada transaksi</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Harian Keuangan</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Harian Keuangan</h1><h2>${title} · Cabang: ${cabangLabel}</h2></div><table><thead><tr><th>Tanggal</th><th>Cabang</th><th>Total Trx</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${total}</td><td>${formatCurrencyPlain(masuk)}</td><td>${formatCurrencyPlain(keluar)}</td><td>${formatCurrencyPlain(net)}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Transaksi — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID</th><th>Deskripsi</th><th>Tipe</th><th>Nominal</th><th>Metode</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })} · ${total} trx detail dijabarkan</p><script>window.print();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function downloadPdfBulanan(month: string, detailRows: Tx[], cabangLabel: string) {
  const title = formatBulanan(month);
  const total = detailRows.length;
  const masuk = detailRows.filter((r) => r.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0);
  const keluar = detailRows.filter((r) => r.type === "pengeluaran").reduce((a, b) => a + Number(b.amount), 0);
  const net = masuk - keluar;
  const detailHtml =
    detailRows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.description ?? ""}</td><td>${r.type}</td><td style="font-family:monospace">${formatCurrencyPlain(Number(r.amount))}</td><td>${r.metode ?? "—"}</td><td>${new Date(r.kas_date).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#6b7280">Tidak ada transaksi</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Bulanan Keuangan</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Bulanan Keuangan</h1><h2>${title} · Cabang: ${cabangLabel}</h2></div><table><thead><tr><th>Bulan</th><th>Cabang</th><th>Total Trx</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${total}</td><td>${formatCurrencyPlain(masuk)}</td><td>${formatCurrencyPlain(keluar)}</td><td>${formatCurrencyPlain(net)}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Transaksi — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID</th><th>Deskripsi</th><th>Tipe</th><th>Nominal</th><th>Metode</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })}</p><script>window.print();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function LaporanKeuanganPage() {
  const [from, setFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to, setTo] = useState<Date | undefined>(() => new Date());
  const [cabang, setCabang] = useState<string>("all");
  const [rows, setRows] = useState<Tx[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [report, setReport] = useState<{
    totalMasuk: number;
    totalKeluar: number;
    totalNet: number;
    transactionCount: number;
    harian: { key: string; masuk: number; keluar: number; net: number; count: number }[];
    bulanan: { key: string; masuk: number; keluar: number; net: number; count: number }[];
    byBranch: { branchId: string | null; branchName: string; masuk: number; keluar: number; net: number; count: number }[];
    byDescription: { name: string; amount: number; pct: number }[];
    monthComparison: { current: number; previous: number; changePct: number | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render when the filter changes so the effect only fetches.
  const queryKey = `${toLocalDateString(from ?? new Date())}:${toLocalDateString(to ?? new Date())}:${cabang}`;
  const [loadedKey, setLoadedKey] = useState(queryKey);
  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setReport(null);
    setRows([]);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    // queryKey is "from:to:branchId" with YYYY-MM-DD dates, so it is the single
    // source of truth for this fetch.
    const [fromDate, toDate, branchId] = queryKey.split(":");
    getLaporanKeuangan({ from: fromDate, to: toDate, branchId })
      .then((data) => {
        if (cancelled) return;
        setReport(data.report);
        setBranches(data.branches);
        setRows(data.transactions);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Gagal memuat laporan keuangan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const cabangLabel = cabang === "all" ? "Semua cabang" : branches.find((b) => b.id === cabang)?.name ?? cabang.slice(0, 6);

  const harian = useMemo(() => (report?.harian ?? []).map((row) => ({ ...row, date: row.key, trx: row.count })), [report]);

  const bulanan = useMemo(() => (report?.bulanan ?? []).map((row) => ({ ...row, month: row.key, total: row.count })), [report]);

  // Net per day for the trend chart, oldest first.
  const chartData = useMemo(() => {
    return harian
      .slice(-30)
      .map((g) => ({ date: g.date.slice(5), net: g.net }));
  }, [harian]);

  const totalMasuk = report?.totalMasuk ?? 0;
  const totalKeluar = report?.totalKeluar ?? 0;
  const totalNet = report?.totalNet ?? 0;

  const monthComparison = report?.monthComparison ?? { current: 0, previous: 0, changePct: null };

  // Real daily income for the month sparkline; no synthetic series when empty.
  const series = useMemo(() => {
    return harian
      .slice(-24)
      .map((g) => g.masuk / 1000);
  }, [harian]);

  // Income split by the description actually recorded on each transaction.
  const allocation = useMemo(() => {
    return (report?.byDescription ?? []).slice(0, 6).map((entry, index) => ({
      name: entry.name,
      pct: entry.pct,
      amount: entry.amount,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    }));
  }, [report]);

  const news = useMemo(() => {
    return rows.slice(0, 4).map((f) => ({
      time: new Date(f.kas_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      source: branches.find((b) => b.id === f.branch_id)?.name ?? "Cervise",
      headline: `${f.type === "pemasukan" ? "Pemasukan" : "Pengeluaran"} ${formatCurrencyPlain(Number(f.amount))} — ${f.description ?? ""}`.slice(0, 80),
    }));
  }, [rows, branches]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Laporan Keuangan"
        titleClassName="font-heading text-2xl"
        description={`Harian & Bulanan · ${cabangLabel} · ${from ? format(from, "d MMM", { locale: localeId }) : ""} — ${to ? format(to, "d MMM yyyy", { locale: localeId }) : ""}`}
        filters={
          <>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 w-auto shrink-0 justify-start font-normal" />}>
                <CalendarIcon className="size-4 opacity-60" />
                {from ? format(from, "d MMM yyyy", { locale: localeId }) : "Tanggal awal"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={from} onSelect={setFrom} /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 w-auto shrink-0 justify-start font-normal" />}>
                <CalendarIcon className="size-4 opacity-60" />
                {to ? format(to, "d MMM yyyy", { locale: localeId }) : "Tanggal akhir"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={to} onSelect={setTo} /></PopoverContent>
            </Popover>
            <Select value={cabang} onValueChange={(v) => setCabang((v as string) ?? "all")}>
              <SelectTrigger size="sm" className="shrink-0"><SelectValue placeholder="Semua cabang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua cabang</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">

        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Total periode terpilih */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Pemasukan (periode)", value: totalMasuk, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "Pengeluaran (periode)", value: totalKeluar, tone: "text-rose-600 dark:text-rose-400" },
            { label: "Netto (periode)", value: totalNet, tone: totalNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" },
            { label: "Transaksi", value: null, tone: "", raw: report?.transactionCount ?? 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{card.label}</div>
              <div className={`mt-2 font-heading text-2xl tabular-nums ${card.tone}`}>
                {card.raw !== undefined ? formatNumberPlain(card.raw) : formatCurrencyPlain(card.value ?? 0)}
              </div>
            </div>
          ))}
        </div>

        {/* Ringkasan periode */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1fr_320px]">
          <div className="bg-background p-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-2xl">IDR</span>
                <span className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">Omzet Bulan Ini</span>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-5xl tabular-nums">{formatCurrencyPlain(monthComparison.current)}</span>
                {monthComparison.changePct === null ? (
                  <span className="font-mono text-xs text-muted-foreground">Bulan lalu tanpa pemasukan — tidak ada pembanding</span>
                ) : (
                  <span className={`inline-flex items-baseline gap-0.5 font-mono tabular-nums ${monthComparison.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {monthComparison.changePct >= 0 ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
                    {Math.abs(monthComparison.changePct)}%
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-muted-foreground text-xs">
                Bulan lalu {formatCurrencyPlain(monthComparison.previous)} · {formatNumberPlain(report?.transactionCount ?? 0)} trx pada periode terpilih
              </div>
            </div>
            <div className="mt-5">
              {series.length > 0 ? (
                <PriceChart values={series} positive={monthComparison.changePct === null || monthComparison.changePct >= 0} />
              ) : (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Belum ada pemasukan untuk ditampilkan</div>
              )}
            </div>
            {chartData.length > 0 ? (
              <div className="mt-5 border-t pt-4">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Netto harian</div>
                <div className="mt-2 h-28 w-full">
                  <NetChart data={chartData} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Sumber Pemasukan</div>
            {allocation.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Belum ada pemasukan pada periode ini.</p>
            ) : (
              <>
                <div className="mt-3 flex justify-center">
                  <div className="h-36 w-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocation} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                          {allocation.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: unknown, _name: unknown, item: { payload?: { amount?: number } }) => `${value}% · ${formatCurrencyPlain(item?.payload?.amount ?? 0)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 font-mono text-[11px]">
                  {allocation.map((a) => (
                    <li key={a.name} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: a.color }} />
                        <span className="truncate">{a.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{a.pct}%</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">Dihitung dari deskripsi yang dicatat pada tiap transaksi pemasukan.</p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.6fr_1fr]">
          <div className="bg-background">
            <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Per Cabang</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                {(report?.byBranch ?? []).length} cabang · periode terpilih
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-border/40 border-b text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                  <th className="px-5 py-2 font-normal">Cabang</th>
                  <th className="px-5 py-2 text-right font-normal">Masuk</th>
                  <th className="px-5 py-2 text-right font-normal">Keluar</th>
                  <th className="px-5 py-2 text-right font-normal">Net</th>
                  <th className="px-5 py-2 text-right font-normal">Trx</th>
                </tr>
              </thead>
              <tbody>
                {(report?.byBranch ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Memuat…" : "Belum ada transaksi pada periode ini"}
                    </td>
                  </tr>
                ) : (
                  (report?.byBranch ?? []).map((branch) => (
                    <tr key={branch.branchId ?? "none"} className="border-border/30 border-b hover:bg-foreground/[0.02]">
                      <td className="px-5 py-2.5 text-sm">{branch.branchName}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">{formatCurrencyPlain(branch.masuk)}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{formatCurrencyPlain(branch.keluar)}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">
                        <span className={branch.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {formatCurrencyPlain(branch.net)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{formatNumberPlain(branch.count)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-background">
            <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Aktivitas Terbaru</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">live</span>
            </div>
            <ul className="divide-y divide-border/40">
              {news.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas</li>
              ) : (
                news.map((n, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                      <span className="tabular-nums">{n.time}</span>
                      <span>·</span>
                      <span>{n.source}</span>
                    </div>
                    <div className="mt-1 text-sm leading-snug">{n.headline}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Harian */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Laporan Harian</CardTitle>
            <CardDescription>Per hari (kas_date) — klik download di baris tanggal</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : harian.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data untuk filter ini</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead className="text-right">Total Trx</TableHead>
                    <TableHead className="text-right">Masuk</TableHead>
                    <TableHead className="text-right">Keluar</TableHead>
                    <TableHead className="text-right">Net (Rp)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {harian.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium whitespace-nowrap">{formatHarian(r.date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{formatCurrencyPlain(r.masuk)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{formatCurrencyPlain(r.keluar)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.date}`}
                          onClick={() => {
                            const detailRows = rows.filter((x) => x.kas_date === r.date);
                            downloadPdfHarian(r.date, detailRows, cabangLabel);
                          }}
                        >
                          <DownloadIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Bulanan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Laporan Bulanan</CardTitle>
            <CardDescription>Per bulan — klik download di baris bulan</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : bulanan.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead className="text-right">Total Trx</TableHead>
                    <TableHead className="text-right">Masuk</TableHead>
                    <TableHead className="text-right">Keluar</TableHead>
                    <TableHead className="text-right">Net (Rp)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulanan.map((r) => (
                    <TableRow key={r.month}>
                      <TableCell className="font-medium whitespace-nowrap">{formatBulanan(r.month)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{formatCurrencyPlain(r.masuk)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{formatCurrencyPlain(r.keluar)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.month}`}
                          onClick={() => {
                            const detailRows = rows.filter((x) => x.kas_date.slice(0, 7) === r.month);
                            downloadPdfBulanan(r.month, detailRows, cabangLabel);
                          }}
                        >
                          <DownloadIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PriceChart({ values, positive }: { values: number[]; positive: boolean }) {
  const w = 700;
  const h = 200;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 20) - 10}`).join(" L ");
  const color = positive ? "rgb(16 185 129)" : "rgb(244 63 94)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mkt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2={w} y1={h * y} y2={h * y} stroke="rgb(127 127 127 / 0.1)" strokeDasharray="2 4" />
      ))}
      <path d={`M 0,${h} L ${pts} L ${w},${h} Z`} fill="url(#mkt-grad)" />
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="1.75" />
    </svg>
  );
}

function NetChart({ data }: { data: { date: string; net: number }[] }) {
  const w = 700;
  const h = 110;
  const values = data.map((d) => d.net);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const stepX = w / Math.max(1, data.length - 1);
  const y = (v: number) => h - ((v - min) / range) * (h - 20) - 10;
  const pts = data.map((d, i) => `${i * stepX},${y(d.net)}`).join(" L ");
  const zeroY = y(0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Netto harian">
      <line x1="0" x2={w} y1={zeroY} y2={zeroY} stroke="rgb(127 127 127 / 0.25)" strokeDasharray="2 4" />
      <path d={`M ${pts}`} fill="none" stroke="rgb(99 102 241)" strokeWidth="1.75" />
    </svg>
  );
}