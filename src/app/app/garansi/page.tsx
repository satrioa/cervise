"use client";

import { useState, useMemo, useEffect } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ShieldCheckIcon, SearchIcon, CalendarIcon, XIcon, FileTextIcon, PhoneIcon, WrenchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Label } from "@/components/ui/label";
import { GaransiField } from "@/components/servis/garansi-field";
import { useBranch } from "@/lib/branch-context";
import { cn } from "@/lib/utils";
import { getServisDetail } from "@/app/app/servis/actions";
import { PageHeader } from "@/components/layout/page-header";

type GaransiRow = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  garansiUntil: string | null;
  garansiValue: number;
  garansiUnit: "hari" | "bulan" | "tahun";
  customer: { name: string; phone: string };
  device: string;
  cabang: string;
  status: string;
};

const DUMMY_GARANSI: GaransiRow[] = [
  { id: "SV-1007", invoiceNo: "INV-12092026120000", createdAt: "2026-09-12", garansiUntil: "2026-10-12", garansiValue: 30, garansiUnit: "hari", customer: { name: "Citra Amelia", phone: "081245667788" }, device: "iPhone 11", cabang: "Cervise Pusat", status: "Sudah Diambil" },
  { id: "SV-1009", invoiceNo: "INV-08092026080000", createdAt: "2026-09-08", garansiUntil: "2026-09-23", garansiValue: 15, garansiUnit: "hari", customer: { name: "Bambang Wijaya", phone: "081299001122" }, device: "Vivo Y20", cabang: "Cervise Pusat", status: "Sudah Diambil" },
  { id: "SV-1008", invoiceNo: "INV-10092026100000", createdAt: "2026-09-10", garansiUntil: "2026-09-20", garansiValue: 10, garansiUnit: "hari", customer: { name: "Doni", phone: "081388990011" }, device: "Xiaomi Redmi", cabang: "Cervise Pusat", status: "Selesai" },
  { id: "SV-1013", invoiceNo: "INV-15092026150000", createdAt: "2026-09-15", garansiUntil: null, garansiValue: 30, garansiUnit: "hari", customer: { name: "Eko", phone: "081212009900" }, device: "Infinix Hot 12", cabang: "Cervise Pusat", status: "Masuk" },
  { id: "SV-1011", invoiceNo: "INV-19092026190000", createdAt: "2026-09-19", garansiUntil: "2026-10-26", garansiValue: 1, garansiUnit: "bulan", customer: { name: "Fajar", phone: "081376543210" }, device: "Realme 11", cabang: "Cervise Pusat", status: "Selesai" },
  { id: "SV-1014", invoiceNo: "INV-19092026191939", createdAt: "2026-09-19", garansiUntil: "2026-09-26", garansiValue: 7, garansiUnit: "hari", customer: { name: "Hadi", phone: "081299887766" }, device: "Oppo A57", cabang: "Cervise Pusat", status: "Batal" },
  { id: "SV-1015", invoiceNo: "INV-21092026070000", createdAt: "2026-09-21", garansiUntil: "2026-12-21", garansiValue: 3, garansiUnit: "bulan", customer: { name: "Rina", phone: "081212345601" }, device: "iPhone 14 Pro", cabang: "Cervise Pusat", status: "Sudah Diambil" },
];

function toDays(value: number, unit: string): number {
  if (unit === "hari") return value;
  if (unit === "bulan") return value * 30;
  if (unit === "tahun") return value * 365;
  return value;
}

function garansiMeta(row: GaransiRow) {
  if (!row.garansiUntil) {
    return { state: "belum_aktif" as const, pct: 0, daysLeft: null as number | null, total: toDays(row.garansiValue, row.garansiUnit) };
  }
  const total = toDays(row.garansiValue, row.garansiUnit) || 90;
  const until = new Date(row.garansiUntil);
  until.setHours(23, 59, 59, 999);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((until.getTime() - now.getTime()) / 86400000);
  const pct = Math.max(0, Math.min(100, Math.round((daysLeft / total) * 100)));
  if (daysLeft < 0) return { state: "expired" as const, pct: 0, daysLeft, total };
  if (daysLeft <= 7) return { state: "segera_habis" as const, pct, daysLeft, total };
  if (daysLeft <= 14) return { state: "warning" as const, pct, daysLeft, total };
  return { state: "aktif" as const, pct, daysLeft, total };
}

export default function GaransiPage() {
  const { branch } = useBranch();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("Semua");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [rows, setRows] = useState<GaransiRow[]>(DUMMY_GARANSI);
  const [perpanjangOpen, setPerpanjangOpen] = useState(false);
  const [selected, setSelected] = useState<GaransiRow | null>(null);
  const [newValue, setNewValue] = useState<number | "">("");
  const [newUnit, setNewUnit] = useState<"hari" | "bulan" | "tahun">("hari");

  // Try to fetch real data, fallback to dummy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Attempt to fetch via getServisDetail for each dummy id is not efficient; keep dummy for demo
        // Real implementation would call getGaransiList server action
      } catch {}
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [branch.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (branch.id !== "all" && r.cabang !== branch.label && branch.label !== "Semua cabang") {
        // If dummy cabang doesn't match branch, filter out
        if (r.cabang !== branch.label) return false;
      }
      if (q.trim()) {
        const hay = `${r.invoiceNo} ${r.customer.name} ${r.customer.phone} ${r.device}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      const meta = garansiMeta(r);
      if (status !== "Semua") {
        if (status === "Aktif" && meta.state !== "aktif") return false;
        if (status === "Segera habis" && meta.state !== "segera_habis") return false;
        if (status === "Expired" && meta.state !== "expired") return false;
        if (status === "Belum aktif" && meta.state !== "belum_aktif") return false;
      }
      if (dateRange.from || dateRange.to) {
        if (!r.garansiUntil) return false;
        const d = new Date(r.garansiUntil);
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
  }, [rows, q, status, dateRange, branch.id, branch.label]);

  const stats = useMemo(() => {
    let aktif = 0,
      segera = 0,
      expired = 0;
    for (const r of filtered) {
      const m = garansiMeta(r);
      if (m.state === "aktif") aktif++;
      else if (m.state === "segera_habis" || m.state === "warning") segera++;
      else if (m.state === "expired") expired++;
    }
    return { aktif, segera, expired, total: filtered.length };
  }, [filtered]);

  const openPerpanjang = (row: GaransiRow) => {
    setSelected(row);
    setNewValue(row.garansiValue);
    setNewUnit(row.garansiUnit);
    setPerpanjangOpen(true);
  };

  const handlePerpanjang = () => {
    if (!selected || newValue === "" || Number(newValue) <= 0) return;
    const val = Number(newValue);
    const unit = newUnit;
    const totalDays = toDays(val, unit);
    const until = new Date();
    until.setHours(23, 59, 59, 999);
    // Add totalDays to today
    until.setDate(until.getDate() + totalDays);
    const newUntil = until.toISOString().slice(0, 10);
    setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, garansiValue: val, garansiUnit: unit, garansiUntil: newUntil } : r)));
    setPerpanjangOpen(false);
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
    return "Rentang Expired";
  })();

  return (
    <div className="bg-background text-foreground">
      <PageHeader
        title="Cek Garansi"
        titleClassName="font-heading text-2xl"
        description={`${stats.total} garansi · ${stats.aktif} aktif · ${stats.segera} segera habis · ${stats.expired} expired · cabang ${branch.label}`}
        toolbar={
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-[300px]">
              <InputGroup className="h-8">
                <InputGroupAddon align="inline-start">
                  <SearchIcon className="size-3.5 opacity-60" />
                </InputGroupAddon>
                <InputGroupInput placeholder="Cari INV, customer, device…" value={q} onChange={(e) => setQ(e.target.value)} className="text-sm" />
                {q && (
                  <InputGroupAddon align="inline-end">
                    <button type="button" onClick={() => setQ("")} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                      <XIcon className="size-3.5" />
                    </button>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>
            <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
              <SelectTrigger className="w-full sm:w-40" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                <SelectItem value="Aktif">Aktif</SelectItem>
                <SelectItem value="Segera habis">Segera habis ≤7d</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Belum aktif">Belum aktif</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="filter" className={`w-full sm:w-auto justify-start gap-2 font-normal text-sm shrink-0 ${!dateRange.from && !dateRange.to && "text-muted-foreground"}`} />
                }
              >
                <CalendarIcon className="size-4 opacity-70" />
                <span className="truncate">{dateLabel}</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => {
                    if (!range) setDateRange({});
                    else setDateRange({ from: range.from, to: range.to });
                  }}
                  numberOfMonths={2}
                />
                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-muted-foreground px-2">{dateRange.from || dateRange.to ? `${filtered.length} hasil` : "Pilih rentang"}</span>
                  <Button variant="ghost" size="xs" onClick={() => setDateRange({})}>
                    Reset
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
          <div className="overflow-x-auto scrollbar-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">No.Invoice</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Expired Date</TableHead>
                  <TableHead className="pe-4 min-w-[180px]">Sisa Garansi</TableHead>
                  <TableHead className="pe-4 w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Tidak ada garansi
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const meta = garansiMeta(r);
                    const tone =
                      meta.state === "expired"
                        ? { bar: "bg-destructive", cls: "border-destructive/30 text-destructive", label: "Expired" }
                        : meta.state === "segera_habis"
                          ? { bar: "bg-amber-500", cls: "border-amber-500/30 text-amber-700", label: `${meta.daysLeft} hari` }
                          : meta.state === "warning"
                            ? { bar: "bg-amber-500", cls: "border-amber-500/30 text-amber-700", label: `${meta.daysLeft} hari` }
                            : meta.state === "belum_aktif"
                              ? { bar: "bg-muted-foreground/40", cls: "border-muted-foreground/30 text-muted-foreground", label: "Belum aktif" }
                              : { bar: "bg-emerald-500", cls: "border-emerald-500/30 text-emerald-700", label: `${meta.daysLeft} hari` };
                    return (
                      <TableRow key={r.id} className={meta.state === "expired" ? "bg-destructive/[0.04]" : meta.state === "segera_habis" ? "bg-amber-500/[0.04]" : undefined}>
                        <TableCell className="ps-4">
                          <div className="flex items-center gap-1.5">
                            <FileTextIcon className="size-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs">{r.invoiceNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{format(new Date(r.createdAt), "d MMM yyyy", { locale: localeId })}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6 bg-foreground/5">
                              <AvatarFallback className="bg-transparent text-[10px]">{r.customer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{r.customer.name}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <PhoneIcon className="size-3" />
                                {r.customer.phone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.device}</TableCell>
                        <TableCell>
                          {r.garansiUntil ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs">
                              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                              {format(new Date(r.garansiUntil), "d MMM yyyy", { locale: localeId })}
                            </span>
                          ) : (
                            <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                              Belum aktif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pe-4">
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full ${tone.bar}`} style={{ width: `${meta.pct}%` }} />
                            </div>
                            <span className="font-mono text-xs w-10 text-right tabular-nums">{meta.pct}%</span>
                            <Badge variant="outline" size="sm" className={`font-mono text-[10px] ${tone.cls}`}>
                              {tone.label}
                            </Badge>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{r.garansiValue} {r.garansiUnit} · {r.cabang}</div>
                        </TableCell>
                        <TableCell className="pe-4">
                          <Button size="xs" variant="outline" onClick={() => openPerpanjang(r)}>
                            Perpanjang
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      <DialogPrimitive.Root open={perpanjangOpen} onOpenChange={setPerpanjangOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Perpanjang Garansi</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Perpanjang garansi untuk {selected?.invoiceNo} — {selected?.device}</DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>Durasi baru</Label>
                <GaransiField value={newValue} unit={newUnit} onValueChange={setNewValue} onUnitChange={setNewUnit} />
              </div>
              {selected && newValue !== "" && (
                <div className="rounded border bg-muted/30 p-2 text-xs font-mono">
                  Baru: {newValue} {newUnit} → sampai{" "}
                  {(() => {
                    const d = new Date();
                    d.setHours(23, 59, 59, 999);
                    d.setDate(d.getDate() + toDays(Number(newValue), newUnit));
                    return format(d, "d MMM yyyy", { locale: localeId });
                  })()}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPerpanjangOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handlePerpanjang}>Simpan</Button>
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
