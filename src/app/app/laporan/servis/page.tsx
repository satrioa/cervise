"use client";

import { useState, useEffect } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DownloadIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { getLaporanServis } from "@/app/app/laporan/servis/actions";
import { toLocalDateString } from "@/lib/operational/garansi-list";
import type { LaporanServis as LaporanServisReport, ServisDetailRow } from "@/lib/operational/laporan-servis";

function formatHarian(iso: string) {
  return format(new Date(iso + "T12:00:00"), "EEEE, d MMMM yyyy", { locale: localeId });
}
function formatBulanan(iso: string) {
  // iso = YYYY-MM
  const d = new Date(iso + "-01T12:00:00");
  return format(d, "MMMM yyyy", { locale: localeId });
}

function printHtml(title: string, subtitle: string, rows: ServisDetailRow[]) {
  const total = rows.length;
  const selesai = rows.filter((r) => r.status === "Selesai" || r.status === "Sudah Diambil").length;
  const batal = rows.filter((r) => r.status === "Batal").length;
  const pending = total - selesai - batal;
  const net = rows.reduce((a, b) => a + b.price, 0);
  const detailHtml =
    rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td style="font-family:monospace">${r.serviceLabel}</td><td>${r.device}</td><td>${r.teknisi}</td><td>${r.status}</td><td style="font-family:monospace">${formatCurrencyPlain(r.price)}</td></tr>`
      )
      .join("") || `<tr><td colspan="6" style="text-align:center;padding:16px;color:#6b7280">Tidak ada servis</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Laporan Servis</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}h2{font-size:12px;color:#6b7280;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:#fff;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb} .mono{font-family:monospace} .header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="header"><h1>Cervise — Laporan Servis</h1><h2>${subtitle}</h2></div><table><thead><tr><th>Periode</th><th>Total Servis</th><th>Selesai</th><th>Batal</th><th>Pending</th><th>Net (Rp)</th></tr></thead><tbody><tr><td>${title}</td><td>${total}</td><td>${selesai}</td><td>${batal}</td><td>${pending}</td><td class="mono">${formatCurrencyPlain(net)}</td></tr></tbody></table><h3 style="margin-top:24px;font-size:14px">Detail Servis — ${total} entri dijabarkan</h3><table><thead><tr><th>No</th><th>ID Servis</th><th>Device</th><th>Teknisi</th><th>Status</th><th>Harga</th></tr></thead><tbody>${detailHtml}</tbody></table><p style="margin-top:16px;font-size:10px;color:#6b7280">Dicetak ${format(new Date(), "EEEE, d MMMM yyyy HH:mm", { locale: localeId })} · ${total} servis detail dijabarkan</p><script>window.print();</script></body></html>`;
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function LaporanServisPage() {
  const [from, setFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to, setTo] = useState<Date | undefined>(() => new Date());
  const [cabang, setCabang] = useState<string>("all");
  const [teknisi, setTeknisi] = useState<string>("all");
  const [report, setReport] = useState<LaporanServisReport | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [teknisis, setTeknisis] = useState<{ id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render when the filter changes so the effect only fetches.
  const queryKey = `${from ? toLocalDateString(from) : ""}:${to ? toLocalDateString(to) : ""}:${cabang}:${teknisi}`;
  const [loadedKey, setLoadedKey] = useState(queryKey);
  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setReport(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    // queryKey is "from:to:branchId:teknisiId"; single source of truth for this fetch.
    const [fromDate, toDate, branchId, teknisiId] = queryKey.split(":");
    getLaporanServis({
      from: fromDate || undefined,
      to: toDate ? `${toDate}T23:59:59.999` : undefined,
      branchId,
      teknisiId,
    })
      .then((data) => {
        if (cancelled) return;
        setReport(data.report);
        setBranches(data.branches);
        setTeknisis(data.technicians);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Gagal memuat laporan servis");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const cabangLabel = cabang === "all" ? "Semua cabang" : branches.find((b) => b.id === cabang)?.name ?? "";
  const teknisiLabel = teknisi === "all" ? "Semua teknisi" : teknisis.find((t) => t.id === teknisi)?.full_name ?? "";

  const harian = report?.harian ?? [];
  const bulanan = report?.bulanan ?? [];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Laporan Servis"
        titleClassName="font-heading text-2xl"
        description={`Harian & Bulanan · kas_date (tanggal servis masuk) · ${cabangLabel} · ${teknisiLabel}`}
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
            <Select value={teknisi} onValueChange={(v) => setTeknisi((v as string) ?? "all")}>
              <SelectTrigger size="sm" className="shrink-0"><SelectValue placeholder="Semua teknisi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua teknisi</SelectItem>
                {teknisis.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.id.slice(0, 6)}</SelectItem>)}
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
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada servis pada periode ini</div>
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
                    <TableRow key={r.key}>
                      <TableCell className="font-medium whitespace-nowrap">{formatHarian(r.key)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{teknisiLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.total)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{formatNumberPlain(r.selesai)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{formatNumberPlain(r.batal)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.pending)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.key}`}
                          onClick={() =>
                            openPrint(
                              printHtml(
                                formatHarian(r.key),
                                `Cabang: ${cabangLabel} · Teknisi: ${teknisiLabel}`,
                                r.services,
                              ),
                            )
                          }
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
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada servis pada periode ini</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulan</TableHead>
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
                    <TableRow key={r.key}>
                      <TableCell className="font-medium whitespace-nowrap">{formatBulanan(r.key)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cabangLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{teknisiLabel}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.total)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{formatNumberPlain(r.selesai)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{formatNumberPlain(r.batal)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatNumberPlain(r.pending)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.net)}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Download ${r.key}`}
                          onClick={() =>
                            openPrint(
                              printHtml(
                                formatBulanan(r.key),
                                `Cabang: ${cabangLabel} · Teknisi: ${teknisiLabel}`,
                                r.services,
                              ),
                            )
                          }
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
