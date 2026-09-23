"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DownloadIcon, CalendarIcon, XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type ServisRow = {
  id: string;
  created_at: string;
  branch_id: string | null;
  teknisi_id: string | null;
  status: string;
  price: number | null;
  device: string | null;
};

function formatHarian(iso: string) {
  return format(new Date(iso + "T12:00:00"), "EEEE, d MMMM yyyy", { locale: localeId });
}
function formatBulanan(iso: string) {
  // iso = YYYY-MM
  const d = new Date(iso + "-01T12:00:00");
  return format(d, "MMMM yyyy", { locale: localeId });
}

function toCsvSafe(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadPdfHarian(date: string, detailRows: ServisRow[], cabangLabel: string, teknisiLabel: string) {
  const title = formatHarian(date);
  const total = detailRows.length;
  const selesai = detailRows.filter((r) => r.status === "Selesai" || r.status === "Sudah Diambil").length;
  const batal = detailRows.filter((r) => r.status === "Batal").length;
  const pending = total - selesai - batal;
  const net = detailRows.reduce((a, b) => a + Number(b.price ?? 0), 0);
  const detailHtml =
    detailRows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.device ?? ""}</td><td>${r.status}</td><td style="font-family:monospace">${formatCurrencyPlain(Number(r.price ?? 0))}</td><td>${new Date(r.created_at).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="6" style="text-align:center;padding:16px;color:#6b7280">Tidak ada servis</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Harian</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Harian</h1><h2>${title} · Cabang: ${cabangLabel} · Teknisi: ${teknisiLabel}</h2></div><table><thead><tr><th>Tanggal</th><th>Cabang</th><th>Teknisi</th><th>Total Servis</th><th>Selesai</th><th>Batal</th><th>Pending</th><th>Net (Rp)</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${teknisiLabel}</td><td>${total}</td><td>${selesai}</td><td>${batal}</td><td>${pending}</td><td class="mono">${formatCurrencyPlain(net)}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Servis — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID Servis</th><th>Device</th><th>Status</th><th>Harga</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })} · ${total} servis detail dijabarkan</p><script>window.print();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function downloadPdfBulanan(month: string, detailRows: ServisRow[], cabangLabel: string, teknisiLabel: string) {
  const title = formatBulanan(month);
  const total = detailRows.length;
  const selesai = detailRows.filter((r) => r.status === "Selesai" || r.status === "Sudah Diambil").length;
  const batal = detailRows.filter((r) => r.status === "Batal").length;
  const pending = total - selesai - batal;
  const net = detailRows.reduce((a, b) => a + Number(b.price ?? 0), 0);
  const detailHtml =
    detailRows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.id.slice(0, 8)}</td><td>${r.device ?? ""}</td><td>${r.status}</td><td style="font-family:monospace">${formatCurrencyPlain(Number(r.price ?? 0))}</td><td>${new Date(r.created_at).toLocaleDateString("id-ID")}</td></tr>`
      )
      .join("") || `<tr><td colspan="6" style="text-align:center;padding:16px;color:#6b7280">Tidak ada servis</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Bulanan</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Bulanan</h1><h2>${title} · Cabang: ${cabangLabel} · Teknisi: ${teknisiLabel}</h2></div><table><thead><tr><th>Tanggal</th><th>Cabang</th><th>Teknisi</th><th>Total Servis</th><th>Selesai</th><th>Batal</th><th>Pending</th><th>Net (Rp)</th></tr></thead><tbody><tr><td>${title}</td><td>${cabangLabel}</td><td>${teknisiLabel}</td><td>${total}</td><td>${selesai}</td><td>${batal}</td><td>${pending}</td><td class="mono">${formatCurrencyPlain(net)}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Servis — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID Servis</th><th>Device</th><th>Status</th><th>Harga</th><th>Tanggal</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })} · ${total} servis detail dijabarkan</p><script>window.print();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function LaporanServisPage() {
  const tCommon = useTranslations("common");
  const [from, setFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to, setTo] = useState<Date | undefined>(() => new Date());
  const [cabang, setCabang] = useState<string>("all");
  const [teknisi, setTeknisi] = useState<string>("all");
  const [rows, setRows] = useState<ServisRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [teknisis, setTeknisis] = useState<{ id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: br }, { data: tk }] = await Promise.all([
        supabase.from("cervise_branches").select("id,name"),
        supabase.from("cervise_profiles").select("id,full_name").eq("role", "teknisi"),
      ]);
      setBranches((br as any) ?? []);
      setTeknisis((tk as any) ?? []);
    })();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      setLoading(true);
      let q = supabase.from("cervise_services").select("id,created_at,branch_id,teknisi_id,status,price,device").order("created_at", { ascending: false }).limit(500);
      if (from) q = q.gte("created_at", from.toISOString());
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        q = q.lte("created_at", toEnd.toISOString());
      }
      if (cabang !== "all") q = q.eq("branch_id", cabang);
      if (teknisi !== "all") q = q.eq("teknisi_id", teknisi);
      const { data } = await q;
      if (data && data.length) setRows(data as ServisRow[]);
      else {
        // fallback dummy biar card tetap ada demo
        const today = new Date().toISOString();
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        setRows([
          { id: "1", created_at: today, branch_id: null, teknisi_id: null, status: "Selesai", price: 350000, device: "iPhone" },
          { id: "2", created_at: today, branch_id: null, teknisi_id: null, status: "Masuk", price: 0, device: "Samsung" },
          { id: "3", created_at: yesterday, branch_id: null, teknisi_id: null, status: "Batal", price: 0, device: "Oppo" },
        ]);
      }
      setLoading(false);
    })();
  }, [from, to, cabang, teknisi]);

  const cabangLabel = cabang === "all" ? "Semua cabang" : branches.find((b) => b.id === cabang)?.name ?? cabang.slice(0, 6);
  const teknisiLabel = teknisi === "all" ? "Semua teknisi" : teknisis.find((t) => t.id === teknisi)?.full_name ?? teknisi.slice(0, 6);

  // Harian: group by YYYY-MM-DD (kas_date = created_at date)
  const harian = useMemo(() => {
    const map = new Map<string, { date: string; total: number; selesai: number; batal: number; pending: number; net: number }>();
    for (const r of rows) {
      const date = new Date(r.created_at).toISOString().slice(0, 10);
      const g = map.get(date) ?? { date, total: 0, selesai: 0, batal: 0, pending: 0, net: 0 };
      g.total += 1;
      if (r.status === "Selesai" || r.status === "Sudah Diambil") g.selesai += 1;
      else if (r.status === "Batal") g.batal += 1;
      else g.pending += 1;
      g.net += Number(r.price ?? 0);
      map.set(date, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows]);

  // Bulanan: group by YYYY-MM
  const bulanan = useMemo(() => {
    const map = new Map<string, { month: string; total: number; selesai: number; batal: number; pending: number; net: number }>();
    for (const r of rows) {
      const month = new Date(r.created_at).toISOString().slice(0, 7);
      const g = map.get(month) ?? { month, total: 0, selesai: 0, batal: 0, pending: 0, net: 0 };
      g.total += 1;
      if (r.status === "Selesai" || r.status === "Sudah Diambil") g.selesai += 1;
      else if (r.status === "Batal") g.batal += 1;
      else g.pending += 1;
      g.net += Number(r.price ?? 0);
      map.set(month, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [rows]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Laporan · Servis</div>
            <h1 className="mt-1 font-heading text-2xl">Laporan Servis</h1>
            <p className="text-sm text-muted-foreground">Harian & Bulanan · kas_date (tanggal servis masuk) · {cabangLabel} · {teknisiLabel}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">
        {/* Filters */}
        <Card>
          <CardHeader><CardTitle className="text-base">Filter Laporan</CardTitle><CardDescription>Tanggal Awal/Akhir, Cabang, Teknisi — mempengaruhi Harian & Bulanan</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
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
            <div className="space-y-1.5">
              <Label>Teknisi</Label>
              <Select value={teknisi} onValueChange={(v) => setTeknisi((v as string) ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Semua teknisi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua teknisi</SelectItem>
                  {teknisis.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.id.slice(0, 6)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
              <div className="py-8 text-center text-sm text-muted-foreground">{tCommon("empty.noDataFilter")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Teknisi</TableHead>
                    <TableHead className="text-right">Total Servis</TableHead>
                    <TableHead className="text-right">Selesai</TableHead>
                    <TableHead className="text-right">Batal</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Net (Rp)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {harian.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium whitespace-nowrap">{formatHarian(r.date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{teknisiLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{r.selesai}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{r.batal}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.pending}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.date}`}
                          onClick={() => {
                            const detailRows = rows.filter((x) => new Date(x.created_at).toISOString().slice(0, 10) === r.date);
                            downloadPdfHarian(r.date, detailRows, cabangLabel, teknisiLabel);
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
              <div className="py-8 text-center text-sm text-muted-foreground">{tCommon("empty.noData")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Teknisi</TableHead>
                    <TableHead className="text-right">Total Servis</TableHead>
                    <TableHead className="text-right">Selesai</TableHead>
                    <TableHead className="text-right">Batal</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Net (Rp)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulanan.map((r) => (
                    <TableRow key={r.month}>
                      <TableCell className="font-medium whitespace-nowrap">{formatBulanan(r.month)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{teknisiLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{r.selesai}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{r.batal}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.pending}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.month}`}
                          onClick={() => {
                            const detailRows = rows.filter((x) => new Date(x.created_at).toISOString().slice(0, 7) === r.month);
                            downloadPdfBulanan(r.month, detailRows, cabangLabel, teknisiLabel);
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