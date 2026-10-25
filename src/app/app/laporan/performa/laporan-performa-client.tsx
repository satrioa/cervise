"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { EllipsisIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { PerformaExport } from "@/components/performa-export";
import { PageHeader } from "@/components/layout/page-header";
import { getPerformaTeknisi } from "@/app/app/laporan/performa/actions";
import { StatValueSkeleton, TableRowsSkeleton } from "@/components/ui/skeleton-shapes";
import type { TeknisiPerformanceRow } from "@/lib/operational/performa-teknisi";

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

function formatBulan(iso: string): string {
  const waktu = new Date(new Date(iso).getTime() + OFFSET_WIB_MS);
  if (Number.isNaN(waktu.getTime())) return "bulan berjalan";
  return `${NAMA_BULAN[waktu.getUTCMonth()]} ${waktu.getUTCFullYear()}`;
}

function labelInsentif(row: TeknisiPerformanceRow): string {
  if (!row.intensifEnabled) return "Off";
  if (row.intensifMode === "percent") return `${row.intensifValue}% dari pendapatan`;
  if (row.intensifMode === "fixed") return `${formatCurrencyPlain(row.intensifValue)} per servis`;
  return `Flat bila ≥ ${row.intensifTarget ?? "—"} servis`;
}

export default function PerformaPage() {
  const [q, setQ] = useState("");
  const [cabangFilter, setCabangFilter] = useState<string>("all");
  const [intensifFilter, setIntensifFilter] = useState<string>("all");
  const [rows, setRows] = useState<TeknisiPerformanceRow[]>([]);
  const [summary, setSummary] = useState<{ technicians: number; selesai: number; revenue: number; insentif: number; selesaiTanpaTanggal: number } | null>(null);
  const [bulan, setBulan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPerformaTeknisi()
      .then((result) => {
        if (cancelled) return;
        if (result.error) setError(result.error);
        else {
          setRows(result.data.report.rows);
          setSummary(result.data.report.summary);
          setBulan(formatBulan(result.data.periode.dari));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cabangOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.branchName).filter((name) => name !== "—"))), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (q.trim() && !row.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      if (cabangFilter !== "all" && row.branchName !== cabangFilter) return false;
      if (intensifFilter === "aktif" && !row.intensifEnabled) return false;
      if (intensifFilter === "off" && row.intensifEnabled) return false;
      return true;
    });
  }, [rows, q, cabangFilter, intensifFilter]);

  const showProgress = filtered.some((row) => row.intensifEnabled && row.intensifTarget != null);
  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Performa Teknisi"
        description={`${filtered.length}/${rows.length} teknisi · bulan ${bulan} · metrik: Selesai + Sudah Diambil · insentif mengikuti pengaturan tiap cabang`}
        containerClassName="max-w-5xl"
        search={
          <div className="relative w-full">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama teknisi…" className="h-8 ps-8" />
          </div>
        }
        filters={
          <>
            <Select value={cabangFilter} onValueChange={(v) => setCabangFilter((v as string) ?? "all")}>
              <SelectTrigger className="shrink-0"><SelectValue placeholder="Semua cabang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua cabang</SelectItem>
                {cabangOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={intensifFilter} onValueChange={(v) => setIntensifFilter((v as string) ?? "all")}>
              <SelectTrigger className="shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="aktif">Insentif aktif</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
            {(q || cabangFilter !== "all" || intensifFilter !== "all") && (
              <>
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">{filtered.length} hasil</span>
                <Button variant="ghost" size="xs" className="h-8 shrink-0" onClick={() => { setQ(""); setCabangFilter("all"); setIntensifFilter("all"); }}>
                  Reset filter
                </Button>
              </>
            )}
          </>
        }
        actions={
          <PerformaExport
            rows={filtered.map((row) => ({
              name: row.name,
              cabang: row.branchName,
              selesai: row.selesai,
              insentif: row.intensifEnabled ? (row.intensifMode === "percent" ? `${row.intensifValue}%` : `${formatCurrencyPlain(row.intensifValue)}`) : "Off",
              totalInsentif: row.insentif,
            }))}
          />
        }
      />

      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl">
        {error ? (
          <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {summary ? (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Teknisi", value: formatNumberPlain(summary.technicians) },
              { label: "Servis selesai", value: formatNumberPlain(summary.selesai) },
              { label: "Pendapatan", value: formatCurrencyPlain(summary.revenue) },
              { label: "Total insentif", value: formatCurrencyPlain(summary.insentif) },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{card.label}</div>
                <div className="mt-2 font-heading text-2xl tabular-nums">{card.value}</div>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["Teknisi", "Servis selesai", "Pendapatan", "Total insentif"].map((label) => (
              <div key={label} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{label}</div>
                <StatValueSkeleton className="mt-2" valueClassName="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : null}
        {summary && summary.selesaiTanpaTanggal > 0 && (
          <p className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {formatNumberPlain(summary.selesaiTanpaTanggal)} servis selesai tidak punya tanggal selesai, jadi tidak
            dihitung di {bulan}. Teknisi yang punya data seperti itu ditandai "+n tanpa tanggal" pada kolom
            Selesai. Angka ini masuk begitu status servis diubah lewat aplikasi.
          </p>
        )}
        <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Teknisi</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Selesai</TableHead>
                <TableHead>Pendapatan</TableHead>
                <TableHead>Insentif</TableHead>
                {showProgress && <TableHead>Progress target</TableHead>}
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton
                  cells={
                    showProgress
                      ? ["text", "text", "badge", "money", "badge", "progress", "icon"]
                      : ["text", "text", "badge", "money", "badge", "icon"]
                  }
                  rows={5}
                />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showProgress ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? "Belum ada teknisi di tenant ini" : "Tidak ada teknisi untuk filter ini"}
                  </TableCell>
                </TableRow>
              ) : null}
              {filtered.map((t) => {
                const pct = t.intensifTarget ? t.targetPct : null;
                const terkumpul = t.intensifMode === "flat" && t.intensifTarget != null && t.selesai >= t.intensifTarget;
                return (
                <TableRow key={t.id}>
                  <TableCell className="ps-4 font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.branchName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" size="sm" className="font-mono tabular-nums">
                        {formatNumberPlain(t.selesai)} servis
                      </Badge>
                      {t.selesaiTanpaTanggal > 0 && (
                        <Badge
                          variant="outline"
                          size="sm"
                          title={`${t.selesaiTanpaTanggal} servis selesai tidak punya tanggal selesai, jadi tidak masuk hitungan bulan ini`}
                          className="gap-1 border-dashed font-mono text-[10px] text-muted-foreground"
                        >
                          +{t.selesaiTanpaTanggal} tanpa tanggal
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{formatCurrencyPlain(t.revenue)}</TableCell>
                  <TableCell>
                    {!t.intensifEnabled ? (
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">Off</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" size="sm" className="font-mono text-[10px] tabular-nums">
                          {labelInsentif(t)}
                        </Badge>
                        <div className="font-mono text-xs tabular-nums">{formatCurrencyPlain(t.insentif)}</div>
                        {t.intensifMode === "flat" && (
                          <div className={terkumpul ? "text-[11px] text-emerald-600 dark:text-emerald-400" : "text-[11px] text-amber-600 dark:text-amber-400"}>
                            {terkumpul ? "Target tercapai" : `Belum tercapai (${t.selesai}/${t.intensifTarget})`}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {showProgress && (
                    <TableCell>
                      {!t.intensifEnabled || t.intensifTarget == null ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        <div className="min-w-[120px] space-y-1">
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="tabular-nums">{t.selesai}/{t.intensifTarget}</span>
                            <span className="tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="pe-4">
                    <Menu>
                      <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions ${t.name}`} />}>
                        <EllipsisIcon />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem>Lihat detail</MenuItem>
                        <MenuItem>Riwayat servis</MenuItem>
                      </MenuPopup>
                    </Menu>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </div>
      </div>
    </div>
  );
}