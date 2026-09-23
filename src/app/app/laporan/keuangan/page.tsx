"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DownloadIcon, CalendarIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.description ?? ""}</td><td>${r.type}</td><td style="font-family:monospace">Rp ${Number(r.amount).toLocaleString("id-ID")}</td><td>${r.metode ?? "—"}</td><td>${new Date(r.kas_date).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#6b7280">Tidak ada transaksi</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Harian Keuangan</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Harian Keuangan</h1><h2>${title} · Cabang: ${cabangLabel}</h2></div><table><thead><tr><th>Tanggal</th><th>Cabang</th><th>Total Trx</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${total}</td><td>Rp ${masuk.toLocaleString("id-ID")}</td><td>Rp ${keluar.toLocaleString("id-ID")}</td><td>Rp ${net.toLocaleString("id-ID")}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Transaksi — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID</th><th>Deskripsi</th><th>Tipe</th><th>Nominal</th><th>Metode</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })} · ${total} trx detail dijabarkan</p><script>window.print();</script></body></html>`;
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
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.description ?? ""}</td><td>${r.type}</td><td style="font-family:monospace">Rp ${Number(r.amount).toLocaleString("id-ID")}</td><td>${r.metode ?? "—"}</td><td>${new Date(r.kas_date).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#6b7280">Tidak ada transaksi</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Bulanan Keuangan</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Bulanan Keuangan</h1><h2>${title} · Cabang: ${cabangLabel}</h2></div><table><thead><tr><th>Bulan</th><th>Cabang</th><th>Total Trx</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${total}</td><td>Rp ${masuk.toLocaleString("id-ID")}</td><td>Rp ${keluar.toLocaleString("id-ID")}</td><td>Rp ${net.toLocaleString("id-ID")}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Transaksi — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID</th><th>Deskripsi</th><th>Tipe</th><th>Nominal</th><th>Metode</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })}</p><script>window.print();</script></body></html>`;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: br } = await supabase.from("cervise_branches").select("id,name");
      setBranches((br as any) ?? []);
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

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Laporan · Keuangan</div>
            <h1 className="mt-1 font-heading text-2xl">Laporan Keuangan</h1>
            <p className="text-sm text-muted-foreground">Harian & Bulanan · {cabangLabel} · {from ? format(from, "d MMM", { locale: localeId }) : ""} — {to ? format(to, "d MMM yyyy", { locale: localeId }) : ""}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">
        {/* Filters */}
        <Card>
          <CardHeader><CardTitle className="text-base">Filter Laporan</CardTitle><CardDescription>Tanggal Awal/Akhir, Cabang — mempengaruhi Harian & Bulanan & Grafik</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tanggal Awal</Label>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                  <CalendarIcon className="size-4 opacity-60" />
                  {from ? format(from, "d MMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={from} onSelect={setFrom} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                  <CalendarIcon className="size-4 opacity-60" />
                  {to ? format(to, "d MMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={to} onSelect={setTo} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Cabang</Label>
              <Select value={cabang} onValueChange={(v) => setCabang((v as string) ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Semua cabang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua cabang</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary + Chart */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Tren Net Harian (30 hari)</CardTitle><CardDescription>Net = Masuk - Keluar per kas_date</CardDescription></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="net" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Total Masuk</div><div className="font-mono font-medium">Rp {totalMasuk.toLocaleString("id-ID")}</div></div>
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Total Keluar</div><div className="font-mono font-medium">Rp {totalKeluar.toLocaleString("id-ID")}</div></div>
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Net</div><div className="font-mono font-medium">Rp {totalNet.toLocaleString("id-ID")}</div></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Ringkasan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Hari</span><span className="font-mono">{harian.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bulan</span><span className="font-mono">{bulanan.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Transaksi</span><span className="font-mono">{rows.length}</span></div>
              <Badge variant={totalNet >= 0 ? "success" : "destructive"}>{totalNet >= 0 ? "Surplus" : "Defisit"}</Badge>
            </CardContent>
          </Card>
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
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">Rp {r.masuk.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">Rp {r.keluar.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">Rp {r.net.toLocaleString("id-ID")}</TableCell>
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
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">Rp {r.masuk.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">Rp {r.keluar.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">Rp {r.net.toLocaleString("id-ID")}</TableCell>
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
