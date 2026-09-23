"use client";

import { useMemo, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { EllipsisIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { PerformaExport } from "@/components/performa-export";

type TeknisiRow = {
  name: string;
  initials: string;
  tone: string;
  cabang: string;
  selesai: number;
  rating: number;
  intensifEnabled: boolean;
  intensifMode: "percent" | "fixed";
  intensifValue: number;
  intensifTarget: number | null;
};

const MOCK_AVG_PRICE = 275_000;

const TEKNISI: TeknisiRow[] = [
  { name: "Rudi Teknisi", initials: "RT", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300", cabang: "Cervise Pusat", selesai: 12, rating: 4.8, intensifEnabled: true, intensifMode: "percent", intensifValue: 5, intensifTarget: 15 },
  { name: "Sari Teknisi", initials: "ST", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300", cabang: "Cervise Cabang 2", selesai: 7, rating: 4.6, intensifEnabled: true, intensifMode: "fixed", intensifValue: 50000, intensifTarget: 10 },
  { name: "Eko Teknisi", initials: "ET", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", cabang: "Cervise Pusat", selesai: 9, rating: 4.7, intensifEnabled: true, intensifMode: "percent", intensifValue: 5, intensifTarget: 15 },
  { name: "Andi Teknisi", initials: "AT", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", cabang: "Cervise Cabang 3", selesai: 5, rating: 4.5, intensifEnabled: false, intensifMode: "percent", intensifValue: 5, intensifTarget: null },
];

function calcInsentif(r: TeknisiRow) {
  if (!r.intensifEnabled) return 0;
  if (r.intensifMode === "fixed") return r.selesai * r.intensifValue;
  return Math.round(r.selesai * MOCK_AVG_PRICE * (r.intensifValue / 100));
}

export default function PerformaPage() {
  const [q, setQ] = useState("");
  const [cabangFilter, setCabangFilter] = useState<string>("all");
  const [intensifFilter, setIntensifFilter] = useState<string>("all");

  const cabangOptions = useMemo(() => Array.from(new Set(TEKNISI.map((t) => t.cabang))), []);

  const filtered = useMemo(() => {
    return TEKNISI.filter((t) => {
      if (q.trim() && !t.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      if (cabangFilter !== "all" && t.cabang !== cabangFilter) return false;
      if (intensifFilter === "aktif" && !t.intensifEnabled) return false;
      if (intensifFilter === "off" && t.intensifEnabled) return false;
      return true;
    });
  }, [q, cabangFilter, intensifFilter]);

  const showProgress = filtered.some((t) => t.intensifEnabled && t.intensifTarget != null);
  return (
    <div className="min-h-svh bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl">Performa Teknisi</h1>
            <p className="text-muted-foreground text-sm">
              {filtered.length}/{TEKNISI.length} teknisi · metrik: Selesai + Sudah Diambil = selesai · insentif per cabang (persentase/nominal) · target opsional
            </p>
          </div>
           <PerformaExport
            rows={filtered.map((t) => ({
              name: t.name,
              cabang: t.cabang,
              selesai: t.selesai,
              rating: t.rating,
              intensif: t.intensifEnabled ? (t.intensifMode === "percent" ? `${t.intensifValue}%` : `${formatCurrencyPlain(t.intensifValue)}`) : "Off",
              totalInsentif: calcInsentif(t),
            }))}
           />
        </header>

        {/* Toolbar filter */}
        <div className="mb-4 rounded-xl border bg-card p-3 shadow-xs/5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Cari teknisi</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama teknisi…" className="ps-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Cabang</Label>
              <Select value={cabangFilter} onValueChange={(v) => setCabangFilter((v as string) ?? "all")}>
                <SelectTrigger><SelectValue placeholder="Semua cabang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua cabang</SelectItem>
                  {cabangOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Insentif</Label>
              <Select value={intensifFilter} onValueChange={(v) => setIntensifFilter((v as string) ?? "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="aktif">Insentif aktif</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(q || cabangFilter !== "all" || intensifFilter !== "all") && (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{filtered.length} hasil</span>
              <Button variant="ghost" size="xs" onClick={() => { setQ(""); setCabangFilter("all"); setIntensifFilter("all"); }}>
                Reset filter
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Teknisi</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Selesai</TableHead>
                <TableHead>Insentif</TableHead>
                {showProgress && <TableHead>Progress target</TableHead>}
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showProgress ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                    Tidak ada teknisi untuk filter ini
                  </TableCell>
                </TableRow>
              ) : null}
              {filtered.map((t) => {
                const total = calcInsentif(t);
                const pct = t.intensifTarget ? Math.min(Math.round((t.selesai / t.intensifTarget) * 100), 100) : null;
                return (
                <TableRow key={t.name}>
                  <TableCell className="ps-4 font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.cabang}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" size="sm" className="font-mono tabular-nums">
                      {t.selesai} servis
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!t.intensifEnabled ? (
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">Off</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" size="sm" className="font-mono text-[10px] tabular-nums">
                          {t.intensifMode === "percent" ? `${t.intensifValue}%` : `${formatCurrencyPlain(t.intensifValue)}`} / servis
                        </Badge>
                        <div className="font-mono text-xs tabular-nums">{formatCurrencyPlain(total)}</div>
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
  );
}