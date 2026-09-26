"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ShieldCheckIcon, SearchIcon, CalendarIcon, XIcon, FileTextIcon, PhoneIcon } from "lucide-react";
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
import { extendGaransi, getGaransiList } from "@/app/app/garansi/actions";
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
  const [rows, setRows] = useState<GaransiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [perpanjangOpen, setPerpanjangOpen] = useState(false);
  const [selected, setSelected] = useState<GaransiRow | null>(null);
  const [newValue, setNewValue] = useState<number | "">("");
  const [newUnit, setNewUnit] = useState<"hari" | "bulan" | "tahun">("hari");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset during render when the branch changes, so the effect only fetches.
  const [loadedBranchId, setLoadedBranchId] = useState(branch.id);
  if (loadedBranchId !== branch.id) {
    setLoadedBranchId(branch.id);
    setRows([]);
    setLoading(true);
    setLoadError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getGaransiList()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Gagal memuat data garansi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branch.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // the server action already scopes to the actor branch; this only guards
      // the case where the client is showing a different selected branch
      if (branch.id !== "all" && r.cabang !== branch.label) return false;
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
    setSaveError(null);
    setPerpanjangOpen(true);
  };

  const handlePerpanjang = async () => {
    if (!selected || newValue === "" || Number(newValue) <= 0 || saving) return;
    const val = Number(newValue);
    const unit = newUnit;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await extendGaransi(selected.id, val, unit);
      const newUntil = result.garansiUntil.slice(0, 10);
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, garansiValue: val, garansiUnit: unit, garansiUntil: newUntil } : r)));
      setPerpanjangOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Gagal memperpanjang garansi");
    } finally {
      setSaving(false);
    }
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
        search={
          <InputGroup className="h-8 w-full">
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
        }
        filters={
          <>
            <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
              <SelectTrigger className="w-40 shrink-0" size="sm">
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
                  <Button variant="outline" size="filter" className={`w-auto shrink-0 justify-start gap-2 font-normal text-sm ${!dateRange.from && !dateRange.to && "text-muted-foreground"}`} />
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
          </>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Memuat data garansi…
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-destructive">
                      {loadError}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
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
              {saveError ? (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPerpanjangOpen(false)} disabled={saving}>
                  Batal
                </Button>
                <Button onClick={handlePerpanjang} disabled={saving || newValue === "" || Number(newValue) <= 0}>
                  {saving ? "Menyimpan…" : "Simpan"}
                </Button>
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
