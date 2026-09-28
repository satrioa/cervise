"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ArrowUpRightIcon, ArrowDownRightIcon, WalletIcon, EllipsisIcon, ChevronDownIcon, SearchIcon, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { ArusKasExport } from "@/components/arus-kas-export";
import { PageHeader } from "@/components/layout/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getFinanceLedger } from "@/app/app/keuangan/actions";
import type { FinanceTx } from "@/lib/operational/laporan-keuangan";
import { isToday, isYesterday, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocale } from "@/lib/localization-context";


function labelFor(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Hari ini";
  if (isYesterday(d)) return "Kemarin";
  return format(d, "EEEE, d MMM yyyy", { locale: localeId });
}

export default function ArusKasPage() {
  const { formatCurrency } = useLocale();
  const formatRp = (n: number) => formatCurrency(Number(n));
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getFinanceLedger();
      if (cancelled) return;
      if (error) {
        setLoadError(error);
        setTxs([]);
        setBranches([]);
      } else {
        setTxs(data.transactions);
        setBranches(data.branches);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // filtering
  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (q.trim()) {
        const hay = `${t.description} ${t.id}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      if (branchFilter !== "all" && t.branch_id !== branchFilter) {
        return false;
      }
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (dateRange.from || dateRange.to) {
        const d = new Date(t.kas_date);
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
  }, [txs, q, branchFilter, typeFilter, dateRange]);

  // grouping by kas_date
  const groups = useMemo(() => {
    const map = new Map<string, { kas_date: string; masuk: number; keluar: number; net: number; txs: FinanceTx[] }>();
    for (const t of filtered) {
      const g = map.get(t.kas_date) ?? { kas_date: t.kas_date, masuk: 0, keluar: 0, net: 0, txs: [] as FinanceTx[] };
      if (t.type === "pemasukan") g.masuk += Number(t.amount);
      else g.keluar += Number(t.amount);
      g.net = g.masuk - g.keluar;
      g.txs.push(t);
      map.set(t.kas_date, g);
    }
    // sort desc by date
    return Array.from(map.values()).sort((a, b) => (a.kas_date < b.kas_date ? 1 : -1));
  }, [filtered]);

  const totalMasuk = groups.reduce((a, g) => a + g.masuk, 0);
  const totalKeluar = groups.reduce((a, g) => a + g.keluar, 0);
  const totalNet = totalMasuk - totalKeluar;

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const paginatedGroups = useMemo(() => groups.slice((page - 1) * pageSize, page * pageSize), [groups, page]);
  const start = groups.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, groups.length);

  useEffect(() => {
    setPage(1);
  }, [q, branchFilter, typeFilter, dateRange]);

  const toggleGroup = (kas_date: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(kas_date)) next.delete(kas_date);
      else next.add(kas_date);
      return next;
    });
  };

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

  const handleExport = () => {
    const rows = groups.flatMap((g) => g.txs.map((t) => `${g.kas_date},${t.type},${t.amount},"${(t.description ?? "").replace(/"/g, '""')}",${branchMap.get(t.branch_id ?? "") ?? ""}`));
    const csv = ["kas_date,type,amount,description,branch", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arus-kas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Arus Kas"
        description="Grouped by hari · collapsed semua · multi open"
        containerClassName="max-w-5xl"
        actions={
          <ArusKasExport
            rows={groups.flatMap((g) =>
              g.txs.map((t) => ({
                date: g.kas_date,
                masuk: t.type === "pemasukan" ? t.amount : 0,
                keluar: t.type === "pengeluaran" ? t.amount : 0,
                net: t.type === "pemasukan" ? t.amount : -t.amount,
                status: t.type === "pemasukan" ? "Surplus" : "Defisit",
              }))
            )}
          />
        }
        search={
          <InputGroup className="h-8 w-full">
            <InputGroupAddon align="inline-start">
              <SearchIcon className="size-3.5 opacity-60" />
            </InputGroupAddon>
            <InputGroupInput placeholder="Cari deskripsi, ID..." value={q} onChange={(e) => setQ(e.target.value)} className="text-sm" />
          </InputGroup>
        }
        filters={
          <>
            <Select value={branchFilter} onValueChange={(v) => setBranchFilter((v as string) ?? "all")}>
              <SelectTrigger size="sm" className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">Semua cabang</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as string) ?? "all")}>
              <SelectTrigger size="sm" className="w-32 shrink-0">
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
                  <Button variant="outline" size="sm" className={cn("w-auto shrink-0 justify-start gap-2 font-normal text-sm", !dateRange.from && !dateRange.to && "text-muted-foreground")} />
                }
              >
                <CalendarIcon className="size-4 opacity-70" />
                <span className="truncate">{dateLabel}</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar mode="range" selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined} onSelect={(range) => { if (!range) setDateRange({}); else setDateRange({ from: range?.from, to: range?.to }); }} numberOfMonths={2} />
                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-muted-foreground px-2">{dateRange.from || dateRange.to ? `${filtered.length} transaksi` : "Pilih rentang"}</span>
                  <Button variant="ghost" size="xs" onClick={() => setDateRange({})}>Reset</Button>
                </div>
              </PopoverContent>
            </Popover>
            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{filtered.length} transaksi · {groups.length} hari</span>
          </>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-8">
        <div className="mx-auto max-w-5xl">
        {loadError ? (
          <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-3 mb-6">
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Kas Masuk (filtered)</div>
            <div className="mt-1 font-heading text-xl">{formatRp(totalMasuk)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{groups.length} hari dengan transaksi</div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Kas Keluar (filtered)</div>
            <div className="mt-1 font-heading text-xl">{formatRp(totalKeluar)}</div>
            <div className="mt-1 text-xs text-muted-foreground">dari transaksi pengeluaran</div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Net Arus Kas</div>
            <div className="mt-1 font-heading text-xl">{formatRp(totalNet)}</div>
            <div className="mt-2">
              <Badge variant={totalNet >= 0 ? "success" : "destructive"}>{totalNet >= 0 ? "Surplus" : "Defisit"}</Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Tanggal</TableHead>
                <TableHead>Masuk</TableHead>
                <TableHead>Keluar</TableHead>
                <TableHead>Net</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {txs.length === 0 ? "Belum ada transaksi kas" : "Tidak ada transaksi yang cocok dengan filter"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedGroups.map((g) => {
                  const surplus = g.net >= 0;
                  const isOpen = openGroups.has(g.kas_date);
                  return (
                    <React.Fragment key={g.kas_date}>
                      <TableRow className="cursor-pointer hover:bg-muted/40 data-[open=true]:bg-muted/30" data-open={isOpen} onClick={() => toggleGroup(g.kas_date)}>
                        <TableCell className="ps-4">
                          <div className="flex items-center gap-2">
                            <ChevronDownIcon className={`size-3.5 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            <span className={`size-1.5 rounded-full ${surplus ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <div>
                              <div className="font-medium text-sm">{labelFor(g.kas_date)}</div>
                              <div className="font-mono text-[11px] text-muted-foreground tabular-nums">{g.kas_date}</div>
                            </div>
                            <Badge variant="secondary" size="sm" className="ml-2 hidden font-mono text-[10px] sm:inline-flex">
                              {g.txs.length} trx
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-emerald-600">
                            <ArrowUpRightIcon className="size-3" />
                            {formatRp(g.masuk)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-rose-600">
                            <ArrowDownRightIcon className="size-3" />
                            {formatRp(g.keluar)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <WalletIcon className="size-3 text-muted-foreground" />
                            <span className="font-mono text-xs font-medium tabular-nums">{formatRp(g.net)}</span>
                            <Badge variant={surplus ? "success" : "destructive"} size="sm">
                              {surplus ? "Surplus" : "Defisit"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="pe-4">
                          <span className="font-mono text-[10px] text-muted-foreground">{isOpen ? "tutup" : "buka"}</span>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${g.kas_date}-detail`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={5} className="p-0">
                            <div className="px-4 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-7 text-[11px]">Jam</TableHead>
                                    <TableHead className="h-7 text-[11px]">Deskripsi</TableHead>
                                    <TableHead className="h-7 text-[11px]">Cabang</TableHead>
                                    <TableHead className="h-7 text-right text-[11px]">Nominal</TableHead>
                                    <TableHead className="h-7 w-px" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {g.txs.map((t) => (
                                    <TableRow key={t.id} className="border-0">
                                      <TableCell className="py-1.5 font-mono text-xs text-muted-foreground tabular-nums">{new Date(t.created_at ?? t.kas_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                                      <TableCell className="py-1.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`size-1.5 rounded-full ${t.type === "pemasukan" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                          <span className="text-xs">{t.description || "—"}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-1.5 text-xs text-muted-foreground">{t.branch_id ? (branchMap.get(t.branch_id) ?? t.branch_id.slice(0, 6)) : "Tanpa cabang"}</TableCell>
                                      <TableCell className="py-1.5 text-right">
                                        <span className={`font-mono text-xs tabular-nums ${t.type === "pemasukan" ? "text-emerald-600" : "text-rose-600"}`}>
                                          {t.type === "pemasukan" ? "+" : "-"}
                                          {formatRp(t.amount)}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-1.5 pe-4">
                                        <Menu>
                                          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions ${t.id}`} />}>
                                            <EllipsisIcon className="size-3.5" />
                                          </MenuTrigger>
                                          <MenuPopup align="end">
                                            <MenuItem>Lihat detail</MenuItem>
                                            <MenuItem>Export</MenuItem>
                                          </MenuPopup>
                                        </Menu>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t p-3">
            <span className="text-muted-foreground text-xs">
              Menampilkan <span className="text-foreground tabular-nums">{start}–{end}</span> dari {groups.length} hari (halaman {page} dari {totalPages})
            </span>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
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
        </div>
      </div>
    </div>
  );
}
