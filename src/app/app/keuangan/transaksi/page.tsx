"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, SearchIcon, CalendarIcon, RefreshCcwIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { TransaksiExportButton } from "@/components/transaksi-export-button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Direction = "in" | "out";

const STATUS_TONE: Record<string, string> = {
  succeeded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

type RawTx = {
  id: string;
  description: string | null;
  type: "pemasukan" | "pengeluaran";
  amount: number;
  kas_date: string;
  created_at: string;
  branch_id: string | null;
  metode: string | null;
};

export default function TransaksiPage() {
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [txsRaw, setTxsRaw] = useState<RawTx[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: rows }, { data: br }] = await Promise.all([
      supabase.from("cervise_finance_tx").select("id,description,type,amount,kas_date,created_at,branch_id,metode").order("kas_date", { ascending: false }).order("created_at", { ascending: false }).limit(100),
      supabase.from("cervise_branches").select("id,name"),
    ]);
    setBranches((br as any) ?? []);
    if (rows && rows.length > 0) {
      setTxsRaw(rows as RawTx[]);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setTxsRaw([
        { id: "dummy1", description: "Servis SV-001 - iPhone 11", type: "pemasukan", amount: 350000, kas_date: today, created_at: new Date().toISOString(), branch_id: null, metode: "Tunai" },
        { id: "dummy2", description: "Beli sparepart LCD", type: "pengeluaran", amount: 200000, kas_date: today, created_at: new Date().toISOString(), branch_id: null, metode: null },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, branchFilter, typeFilter, dateRange]);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const filteredRaw = useMemo(() => {
    return txsRaw.filter((r) => {
      if (q.trim()) {
        const hay = `${r.description ?? ""} ${r.id} ${branchMap.get(r.branch_id ?? "") ?? ""}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      if (branchFilter !== "all" && r.branch_id !== branchFilter) {
        if (!(branchFilter === "pusat" && !r.branch_id)) return false;
      }
      if (typeFilter !== "all") {
        if (typeFilter === "pemasukan" && r.type !== "pemasukan") return false;
        if (typeFilter === "pengeluaran" && r.type !== "pengeluaran") return false;
        if (typeFilter === "in" && r.type !== "pemasukan") return false;
        if (typeFilter === "out" && r.type !== "pengeluaran") return false;
      }
      if (dateRange.from || dateRange.to) {
        const d = new Date(r.kas_date);
        d.setHours(0, 0, 0, 0);
        if (dateRange.from) {
          const from = new Date(dateRange.from);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (dateRange.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }
      return true;
    });
  }, [txsRaw, q, branchFilter, typeFilter, dateRange, branchMap]);

  const txs = useMemo(() => {
    return filteredRaw.map((r: any) => ({
      id: String(r.id).slice(0, 8).toUpperCase(),
      rawId: r.id,
      date: new Date(r.kas_date).toLocaleDateString("id-ID", { month: "short", day: "numeric" }) + " · " + new Date(r.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      kas_date: r.kas_date,
      description: r.description ?? "—",
      counterparty: r.branch_id ? (branchMap.get(r.branch_id) || String(r.branch_id).slice(0, 6)) : "Cervise Pusat",
      amount: Number(r.amount),
      direction: (r.type === "pemasukan" ? "in" : "out") as Direction,
      metode: r.metode ?? null,
      status: (r.type === "pemasukan" ? "succeeded" : "pending") as string,
      type: r.type,
    }));
  }, [filteredRaw, branchMap]);

  const totalPages = Math.max(1, Math.ceil(txs.length / pageSize));
  const paginated = useMemo(() => txs.slice((page - 1) * pageSize, page * pageSize), [txs, page]);
  const start = txs.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, txs.length);

  const inflow = txs.filter((t) => t.direction === "in").reduce((a, b) => a + b.amount, 0);
  const outflow = txs.filter((t) => t.direction === "out").reduce((a, b) => a + b.amount, 0);

  const dateLabel = (() => {
    if (dateRange.from && dateRange.to) {
      if (dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear()) {
        return `${format(dateRange.from, "d", { locale: localeId })}–${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
      }
      return `${format(dateRange.from, "d MMM", { locale: localeId })} – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
    }
    if (dateRange.from) return format(dateRange.from, "d MMM yyyy", { locale: localeId });
    if (dateRange.to) return format(dateRange.to, "d MMM yyyy", { locale: localeId });
    return "Rentang tanggal";
  })();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Keuangan · Transaksi</div>
            <h1 className="mt-1 font-heading text-2xl">Transaksi</h1>
            <p className="text-muted-foreground text-sm">Cervise · {branchMap.size || 1} cabang · {filteredRaw.length} transaksi (limit 100, order kas_date)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchData}>
              <RefreshCcwIcon /> Refresh
            </Button>
            <TransaksiExportButton rows={txs as any} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SummaryTile label="Pemasukan" amount={inflow} tone="positive" />
          <SummaryTile label="Pengeluaran" amount={outflow} tone="negative" />
          <SummaryTile label="Net" amount={inflow - outflow} tone="neutral" />
        </div>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <SearchIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput placeholder="Cari deskripsi, ID, cabang..." value={q} onChange={(e) => setQ(e.target.value)} />
              {q && (
                <InputGroupAddon align="inline-end">
                  <button type="button" onClick={() => setQ("")} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3.5" />
                  </button>
                </InputGroupAddon>
              )}
            </InputGroup>
            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
            <Select value={branchFilter} onValueChange={(v) => setBranchFilter((v as string) ?? "all")}>
              <SelectTrigger className="w-full sm:w-36" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">Semua cabang</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
                {branches.length === 0 && <SelectItem value="pusat">Cervise Pusat</SelectItem>}
              </SelectPopup>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as string) ?? "all")}>
              <SelectTrigger className="w-full sm:w-32" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">Masuk + Keluar</SelectItem>
                <SelectItem value="pemasukan">Masuk</SelectItem>
                <SelectItem value="pengeluaran">Keluar</SelectItem>
              </SelectPopup>
            </Select>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className={cn("w-full sm:w-auto justify-start gap-2 font-normal text-sm", !dateRange.from && !dateRange.to && "text-muted-foreground")} />
                }
              >
                <CalendarIcon className="size-4 opacity-70" />
                <span className="truncate">{dateLabel}</span>
                {(dateRange.from || dateRange.to) && (
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDateRange({}); }} className="ml-1 rounded p-0.5 hover:bg-foreground/10 -mr-1" aria-label="Hapus rentang">
                    <XIcon className="size-3.5" />
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar mode="range" selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined} onSelect={(range) => { if (!range) setDateRange({}); else setDateRange({ from: range?.from, to: range?.to }); }} numberOfMonths={2} />
                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-muted-foreground px-2">{dateRange.from || dateRange.to ? `${filteredRaw.length} transaksi` : "Pilih rentang"}</span>
                  <Button variant="ghost" size="xs" onClick={() => setDateRange({})}>Reset</Button>
                </div>
              </PopoverContent>
            </Popover>
            <span className="ms-auto hidden font-mono text-[11px] text-muted-foreground sm:block">{loading ? "memuat..." : `${txs.length} transaksi`}</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pe-4 text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : txs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada data untuk filter ini
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada data untuk halaman ini
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((t) => (
                  <TableRow key={t.rawId}>
                    <TableCell className="ps-4 text-muted-foreground tabular-nums text-sm">{t.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={"flex size-7 shrink-0 items-center justify-center rounded-full " + (t.direction === "in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")} aria-hidden>
                          {t.direction === "in" ? <ArrowDownLeftIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{t.description}</div>
                          <div className="font-mono text-muted-foreground text-xs">{t.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.counterparty}</TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                        {t.metode ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={"capitalize " + STATUS_TONE[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="pe-4 text-right">
                      <div className={"font-mono tabular-nums " + (t.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                        {t.direction === "in" ? "+" : "−"}Rp {t.amount.toLocaleString("id-ID")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t p-3">
            <span className="text-muted-foreground text-xs">
              Menampilkan <span className="text-foreground tabular-nums">{start}–{end}</span> dari {txs.length} (halaman {page} dari {totalPages})
            </span>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  // simple: show first 5, if totalPages >5 show last page separately
                  if (totalPages <= 5) return p;
                  if (p <= 3) return p;
                  if (p === 4) return totalPages - 1;
                  if (p === 5) return totalPages;
                  return null;
                })
                  .filter(Boolean)
                  .map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p as number); }}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                {totalPages > 5 && page > 3 && page < totalPages - 1 && <span className="px-2 text-xs text-muted-foreground">…</span>}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }} aria-disabled={page === totalPages} className={page === totalPages ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryTile({ label, amount, tone }: { label: string; amount: number; tone: "positive" | "negative" | "neutral" }) {
  const sign = tone === "negative" ? "−" : "+";
  const cls = tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs/5">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
      <div className={"mt-1.5 font-heading font-semibold text-2xl tabular-nums " + cls}>{sign}Rp {Math.abs(amount).toLocaleString("id-ID")}</div>
    </div>
  );
}
