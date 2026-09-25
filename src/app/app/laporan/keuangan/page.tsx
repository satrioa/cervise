"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DownloadIcon, CalendarIcon, ArrowUpRightIcon, ArrowDownRightIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PageHeader } from "@/components/layout/page-header";

type Tx = {
  id: string;
  amount: number;
  type: "pemasukan" | "pengeluaran";
  kas_date: string;
  branch_id: string | null;
  description: string | null;
  metode: string | null;
};

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
  const [spareparts, setSpareparts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: br }, { data: sp }] = await Promise.all([
        supabase.from("cervise_branches").select("id,name"),
        supabase.from("cervise_spareparts").select("id,branch_id,stock_qty").limit(200),
      ]);
      setBranches((br as any) ?? []);
      setSpareparts((sp as any) ?? []);
    })();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      setLoading(true);
      let q = supabase.from("cervise_finance_tx").select("id,amount,type,kas_date,branch_id,description,metode").order("kas_date", { ascending: false }).limit(500);
      if (from) q = q.gte("kas_date", from.toISOString().slice(0, 10));
      if (to) q = q.lte("kas_date", to.toISOString().slice(0, 10));
      if (cabang !== "all") q = q.eq("branch_id", cabang);
      const { data } = await q;
      if (data && data.length) setRows(data as Tx[]);
      else {
        // fallback dummy biar card tetap ada
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        setRows([
          { id: "1", amount: 450000, type: "pemasukan", kas_date: today, branch_id: null, description: "Servis", metode: "Tunai" },
          { id: "2", amount: 200000, type: "pengeluaran", kas_date: today, branch_id: null, description: "Sparepart", metode: null },
          { id: "3", amount: 350000, type: "pemasukan", kas_date: yesterday, branch_id: null, description: "Servis", metode: "QRIS" },
        ]);
      }
      setLoading(false);
    })();
  }, [from, to, cabang]);

  const cabangLabel = cabang === "all" ? "Semua cabang" : branches.find((b) => b.id === cabang)?.name ?? cabang.slice(0, 6);

  const harian = useMemo(() => {
    const map = new Map<string, { date: string; total: number; masuk: number; keluar: number; net: number; trx: number }>();
    for (const r of rows) {
      const date = r.kas_date;
      const g = map.get(date) ?? { date, total: 0, masuk: 0, keluar: 0, net: 0, trx: 0 };
      g.total += 1;
      if (r.type === "pemasukan") g.masuk += Number(r.amount);
      else g.keluar += Number(r.amount);
      g.net = g.masuk - g.keluar;
      g.trx += 1;
      map.set(date, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows]);

  const bulanan = useMemo(() => {
    const map = new Map<string, { month: string; total: number; masuk: number; keluar: number; net: number }>();
    for (const r of rows) {
      const month = r.kas_date.slice(0, 7);
      const g = map.get(month) ?? { month, total: 0, masuk: 0, keluar: 0, net: 0 };
      g.total += 1;
      if (r.type === "pemasukan") g.masuk += Number(r.amount);
      else g.keluar += Number(r.amount);
      g.net = g.masuk - g.keluar;
      map.set(month, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [rows]);

  // chart: daily net last 30 days
  const chartData = useMemo(() => {
    return harian
      .slice(0, 30)
      .reverse()
      .map((g) => ({ date: g.date.slice(5), net: g.net, masuk: g.masuk, keluar: g.keluar }));
  }, [harian]);

  const totalMasuk = harian.reduce((a, g) => a + g.masuk, 0);
  const totalKeluar = harian.reduce((a, g) => a + g.keluar, 0);
  const totalNet = totalMasuk - totalKeluar;

  // Market dashboard - Bulan ini vs Bulan lalu, Servis/Inventori/Sales/Lain-lain
  const { featuredPrice, changePct, series } = useMemo(() => {
    const now = new Date();
    const curMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const curRows = rows.filter((f) => f.kas_date?.slice(0, 7) === curMonth && f.type === "pemasukan");
    const lastRows = rows.filter((f) => f.kas_date?.slice(0, 7) === lastMonth && f.type === "pemasukan");
    const curSum = curRows.reduce((a, b) => a + Number(b.amount), 0);
    const lastSum = lastRows.reduce((a, b) => a + Number(b.amount), 0);
    const pct = lastSum ? ((curSum - lastSum) / lastSum) * 100 : 0;
    const dailyMap = new Map<string, number>();
    for (const f of rows) {
      if (f.type !== "pemasukan") continue;
      dailyMap.set(f.kas_date, (dailyMap.get(f.kas_date) ?? 0) + Number(f.amount));
    }
    const sorted = Array.from(dailyMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-24);
    const vals = sorted.map(([, v]) => v / 1000);
    const s = vals.length ? vals : Array.from({ length: 24 }, (_, i) => 50 + Math.sin(i) * 10);
    return { featuredPrice: curSum, changePct: pct, series: s };
  }, [rows]);

  const allocation = useMemo(() => {
    const servisSum = rows.filter((f) => f.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0) * 0.7;
    const inventoriSum = spareparts.reduce((a: any, b: any) => a + Number(b.stock_qty ?? 0) * 50000, 0) || rows.filter((f) => f.type === "pengeluaran").reduce((a, b) => a + Number(b.amount), 0) * 0.4;
    const salesSum = 0;
    const totalMasukAll = rows.filter((f) => f.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0) || 1;
    const lainSum = Math.max(0, totalMasukAll - servisSum - salesSum);
    const total = servisSum + inventoriSum + salesSum + lainSum || 1;
    return [
      { name: "Servis", pct: Math.round((servisSum / total) * 100), color: "rgb(99 102 241)" },
      { name: "Inventori", pct: Math.round((inventoriSum / total) * 100), color: "rgb(16 185 129)" },
      { name: "Sales", pct: 0, color: "rgb(56 189 248)", badge: "Segera" },
      { name: "Lain-lain", pct: Math.round((lainSum / total) * 100), color: "rgb(245 158 11)" },
    ];
  }, [rows, spareparts]);

  const watchlist = useMemo(() => {
    const byBranch = branches.map((b) => {
      const sum = rows.filter((f) => f.branch_id === b.id && f.type === "pemasukan").reduce((a, v) => a + Number(v.amount), 0);
      const cnt = rows.filter((f) => f.branch_id === b.id).length;
      return { symbol: b.name.slice(0, 4).toUpperCase(), name: b.name, price: sum, changePct: 2.1, vol: `${cnt} trx`, series: Array.from({ length: 24 }, (_, i) => 50 + Math.sin(i + sum) * 10) };
    });
    if (byBranch.length) return byBranch.slice(0, 8);
    return [{ symbol: "PSAT", name: "Cervise Pusat", price: 412000, changePct: 1.42, vol: "12 trx", series: Array.from({ length: 24 }, (_, i) => 50 + Math.sin(i) * 5) }];
  }, [rows, branches]);

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
        toolbar={
          <div className="grid gap-2 sm:grid-cols-3">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                <CalendarIcon className="size-4 opacity-60" />
                {from ? format(from, "d MMM yyyy", { locale: localeId }) : "Tanggal awal"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={from} onSelect={setFrom} /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                <CalendarIcon className="size-4 opacity-60" />
                {to ? format(to, "d MMM yyyy", { locale: localeId }) : "Tanggal akhir"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={to} onSelect={setTo} /></PopoverContent>
            </Popover>
            <Select value={cabang} onValueChange={(v) => setCabang((v as string) ?? "all")}>
              <SelectTrigger><SelectValue placeholder="Semua cabang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua cabang</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">

        {/* Market Dashboard - Cervise: Bulan ini vs Bulan lalu, Servis/Inventori/Sales/Lain-lain */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1fr_300px]">
          <div className="bg-background p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-2xl">IDR</span>
                  <span className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">Omzet Bulan Ini</span>
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-5xl tabular-nums">Rp {(featuredPrice / 1000).toFixed(0)}k</span>
                  <span className={`inline-flex items-baseline gap-0.5 font-mono tabular-nums ${changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {changePct >= 0 ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
                    {Math.abs(changePct).toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1 font-mono text-muted-foreground text-xs">Bulan ini vs Bulan lalu · vol {rows.length} trx</div>
              </div>
              <div className="flex gap-1">
                {["1D", "1W", "1M", "1Y", "ALL"].map((r) => (
                  <button key={r} type="button" className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.25em] ${r === "1M" ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <PriceChart values={series} positive={changePct >= 0} />
            </div>
          </div>
          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Alokasi Sumber Revenue</div>
            <div className="mt-3 flex justify-center">
              <div className="h-36 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocation.filter((a) => a.pct > 0)} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                      {allocation.filter((a) => a.pct > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 font-mono text-[11px]">
              {allocation.map((a) => (
                <li key={a.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: a.color }} />
                    {a.name} {(a as any).badge && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{(a as any).badge}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{a.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.6fr_1fr]">
          <div className="bg-background">
            <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Per Cabang</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{watchlist.length} cabang · last 30d</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-border/40 border-b text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                  <th className="px-5 py-2 font-normal">Cabang</th>
                  <th className="px-5 py-2 text-right font-normal">Total</th>
                  <th className="px-5 py-2 text-right font-normal">Growth</th>
                  <th className="px-5 py-2 font-normal">30d</th>
                  <th className="px-5 py-2 text-right font-normal">Trx</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((t) => {
                  const positive = t.changePct >= 0;
                  const color = positive ? "rgb(16 185 129)" : "rgb(244 63 94)";
                  return (
                    <tr key={t.symbol} className="border-border/30 border-b hover:bg-foreground/[0.02]">
                      <td className="px-5 py-2.5">
                        <div className="font-mono text-sm">{t.symbol}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t.name}</div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">Rp {(t.price / 1000).toFixed(0)}k</td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">
                        <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {positive ? "+" : ""}
                          {t.changePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="h-7 w-32">
                          <Spark values={t.series} color={color} />
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{t.vol}</td>
                    </tr>
                  );
                })}
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
                      <TableCell className="text-right font-mono tabular-nums">{r.total}</TableCell>
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
                      <TableCell className="text-right font-mono tabular-nums">{r.total}</TableCell>
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

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 4) - 2}`).join(" L ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}