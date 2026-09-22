"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  PlusIcon,
  ShieldIcon,
  XIcon,
  WrenchIcon,
  SearchIcon,
  CalendarIcon,
} from "lucide-react";
import { format, subHours, subDays, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Outcome = "success" | "denied" | "alert";

interface Entry {
  ts: string;
  date: string; // YYYY-MM-DD
  actor: { name: string; role: string; initials: string; tone: string };
  action: string;
  resource: string;
  cabang: string;
  device: string;
  outcome: Outcome;
}

// Cervise-adapted entries spread across dates for Waktu filtering
const ENTRIES: Entry[] = [
  { ts: "09:12:22", date: "2026-09-22", actor: { name: "Rina Frontliner", role: "Frontliner", initials: "RF", tone: "bg-rose-500/15" }, action: "servis.create", resource: "SV-1013 · Samsung A54", cabang: "Cervise Pusat", device: "iPhone · iOS", outcome: "success" },
  { ts: "09:15:03", date: "2026-09-22", actor: { name: "Rudi Teknisi", role: "Teknisi", initials: "RT", tone: "bg-emerald-500/15" }, action: "servis.status.update", resource: "SV-1002 Masuk → Diagnosa", cabang: "Cervise Pusat", device: "Desktop · Chrome", outcome: "success" },
  { ts: "09:28:41", date: "2026-09-22", actor: { name: "Sari Teknisi", role: "Teknisi", initials: "ST", tone: "bg-emerald-500/15" }, action: "servis.assign", resource: "SV-1005 → Sari", cabang: "Cervise Pusat", device: "Desktop · Chrome", outcome: "success" },
  { ts: "09:42:11", date: "2026-08-25", actor: { name: "Budi Admin", role: "Admin", initials: "BA", tone: "bg-sky-500/15" }, action: "servis.price.update", resource: "SV-1004 Rp 0 → Rp 350.000", cabang: "Cervise Pusat", device: "Desktop · Chrome", outcome: "success" },
  { ts: "10:05:22", date: "2026-09-15", actor: { name: "Master Admin", role: "Super Owner", initials: "MA", tone: "bg-violet-500/15" }, action: "auth.role.update", resource: "user:agil → teknisi", cabang: "Semua cabang", device: "Desktop · Chrome", outcome: "success" },
  { ts: "10:18:00", date: "2026-09-22", actor: { name: "—", role: "System", initials: "•", tone: "bg-muted" }, action: "garansi.auto_expire", resource: "SV-1009 · garansi habis", cabang: "Cervise Pusat", device: "System", outcome: "alert" },
  { ts: "10:33:47", date: "2026-09-21", actor: { name: "Doni Frontliner", role: "Frontliner", initials: "DF", tone: "bg-rose-500/15" }, action: "keuangan.tx.create", resource: "INV-2026-09-012 · Rp 400.000", cabang: "Cervise Cabang 2", device: "Android · App", outcome: "success" },
  { ts: "10:41:33", date: "2026-09-18", actor: { name: "Eko Teknisi", role: "Teknisi", initials: "ET", tone: "bg-emerald-500/15" }, action: "inventory.stock.adjust", resource: "LCD iPhone 11 -1", cabang: "Cervise Pusat", device: "Desktop · Chrome", outcome: "success" },
  { ts: "11:02:18", date: "2026-09-22", actor: { name: "Rina Frontliner", role: "Frontliner", initials: "RF", tone: "bg-rose-500/15" }, action: "servis.status.update", resource: "SV-1010 Masuk → Diagnosa", cabang: "Cervise Pusat", device: "iPhone · iOS", outcome: "denied" },
  { ts: "11:12:04", date: "2026-09-22", actor: { name: "—", role: "Guest", initials: "?", tone: "bg-muted" }, action: "auth.login.attempt", resource: "user:unknown", cabang: "—", device: "Unknown · 45.92.180.220", outcome: "alert" },
];

const OUTCOME: Record<Outcome, { label: string; cls: string; Icon: typeof CircleCheckIcon }> = {
  success: { label: "Berhasil", cls: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400", Icon: CircleCheckIcon },
  denied: { label: "Ditolak", cls: "border-amber-500/30 text-amber-700 dark:text-amber-400", Icon: CircleSlashIcon },
  alert: { label: "Perlu cek", cls: "border-destructive/30 text-destructive", Icon: CircleAlertIcon },
};

type WaktuPreset = "24 jam terakhir" | "Hari ini" | "7d" | "30d" | "90d" | "Custom";

const WAKTU_OPTIONS: WaktuPreset[] = ["24 jam terakhir", "Hari ini", "7d", "30d", "90d", "Custom"];
const AKSI_OPTIONS = ["Semua", "servis", "auth", "garansi", "keuangan", "inventory"] as const;
const ROLE_OPTIONS = ["Semua", "Frontliner", "Teknisi", "Admin", "Super Owner", "System", "Guest"] as const;

// For person cascade
const ALL_PERSONS = Array.from(new Set(ENTRIES.map((e) => e.actor.name))).filter((n) => n !== "—");

function getPersonsForRole(role: string): string[] {
  if (role === "Semua") return ALL_PERSONS;
  return Array.from(new Set(ENTRIES.filter((e) => e.actor.role === role).map((e) => e.actor.name)));
}

export function TableAuditLogShowcasePage() {
  return (
    <div className="bg-background px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-xl">
              <ShieldIcon className="size-5 text-muted-foreground" />
              Audit log
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <WrenchIcon className="size-3.5" /> Aktivitas servis · 24 jam terakhir · {ENTRIES.length} dari 1.284
            </p>
          </div>
          <Button size="sm" variant="outline">Export CSV</Button>
        </header>

        <CerviseAuditLogTable />
      </div>
    </div>
  );
}

export function CerviseAuditLogTable({ cabangFilter }: { cabangFilter?: string } = {}) {
  const router = useRouter();

  // ----- state -----
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Outcome[]>(["success", "alert"]); // default Berhasil + Perlu cek
  const [aksi, setAksi] = useState<string>("servis");
  const [aktorRole, setAktorRole] = useState<string>("Teknisi");
  const [person, setPerson] = useState<string>("Semua");
  const [waktu, setWaktu] = useState<WaktuPreset>("24 jam terakhir");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [statusOpen, setStatusOpen] = useState(false);
  const [aksiOpen, setAksiOpen] = useState(false);
  const [aktorOpen, setAktorOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [waktuOpen, setWaktuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // persons available for current role
  const availablePersons = useMemo(() => getPersonsForRole(aktorRole), [aktorRole]);

  // reset person when role changes and person not in new list
  useEffect(() => {
    if (person !== "Semua" && !availablePersons.includes(person)) {
      setPerson("Semua");
    }
  }, [availablePersons, person]);

  // ----- persistence: load from URL + localStorage -----
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // URL takes precedence, else localStorage (client only)
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const hasUrl = Array.from(params.keys()).length > 0;
    if (hasUrl) {
      const q = params.get("q") || "";
      const s = params.get("status");
      const a = params.get("aksi");
      const r = params.get("role");
      const p = params.get("person");
      const w = params.get("waktu") as WaktuPreset | null;
      const from = params.get("from");
      const to = params.get("to");
      if (q) setSearch(q);
      if (s) {
        const vals = s.split(",").filter((v) => ["success", "denied", "alert"].includes(v)) as Outcome[];
        if (vals.length) setStatus(vals);
      }
      if (a && (AKSI_OPTIONS as readonly string[]).includes(a)) setAksi(a);
      if (r && (ROLE_OPTIONS as readonly string[]).includes(r)) setAktorRole(r);
      if (p) setPerson(p);
      if (w && WAKTU_OPTIONS.includes(w)) setWaktu(w);
      if (from || to) {
        setDateRange({
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        });
        if (w !== "Custom" && (from || to)) setWaktu("Custom");
      }
      setHydrated(true);
      return;
    }
    // fallback localStorage
    try {
      const saved = localStorage.getItem("cervise-audit-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.search === "string") setSearch(parsed.search);
        if (Array.isArray(parsed.status)) setStatus(parsed.status);
        if (typeof parsed.aksi === "string") setAksi(parsed.aksi);
        if (typeof parsed.aktorRole === "string") setAktorRole(parsed.aktorRole);
        if (typeof parsed.person === "string") setPerson(parsed.person);
        if (typeof parsed.waktu === "string" && WAKTU_OPTIONS.includes(parsed.waktu)) setWaktu(parsed.waktu);
        if (parsed.dateRange?.from || parsed.dateRange?.to) {
          setDateRange({
            from: parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined,
            to: parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined,
          });
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // save to localStorage + URL (debounced for search)
  useEffect(() => {
    if (!hydrated) return;
    const payload = { search, status, aksi, aktorRole, person, waktu, dateRange: { from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() } };
    try {
      localStorage.setItem("cervise-audit-filters", JSON.stringify(payload));
    } catch {}
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status.length !== 3) params.set("status", status.join(","));
    if (aksi !== "Semua") params.set("aksi", aksi);
    if (aktorRole !== "Semua") params.set("role", aktorRole);
    if (person !== "Semua") params.set("person", person);
    if (waktu !== "24 jam terakhir") params.set("waktu", waktu);
    if (waktu === "Custom" && (dateRange.from || dateRange.to)) {
      if (dateRange.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    router.replace(url, { scroll: false });
  }, [search, status, aksi, aktorRole, person, waktu, dateRange, hydrated, router]);

  // ----- helpers -----
  const toggleStatus = (outcome: Outcome) => {
    setStatus((prev) => (prev.includes(outcome) ? prev.filter((s) => s !== outcome) : [...prev, outcome]));
  };

  const isWaktuDefault = waktu === "24 jam terakhir" && !dateRange.from && !dateRange.to;
  const activeCount =
    (search ? 1 : 0) +
    (status.length !== 3 ? 1 : 0) +
    (aksi !== "Semua" ? 1 : 0) +
    (aktorRole !== "Semua" ? 1 : 0) +
    (person !== "Semua" ? 1 : 0) +
    (waktu !== "24 jam terakhir" || dateRange.from || dateRange.to ? 1 : 0);

  const now = useMemo(() => new Date(), []); // stable for session; could use Date.now() per render

  const matchesWaktu = useCallback(
    (entry: Entry) => {
      const entryDate = new Date(entry.date + "T" + entry.ts);
      if (waktu === "24 jam terakhir") {
        return entryDate >= subHours(now, 24);
      }
      if (waktu === "Hari ini") {
        const d = startOfDay(now);
        const e = endOfDay(now);
        return entryDate >= d && entryDate <= e;
      }
      if (waktu === "7d") return entryDate >= subDays(startOfDay(now), 6);
      if (waktu === "30d") return entryDate >= subDays(startOfDay(now), 29);
      if (waktu === "90d") return entryDate >= subDays(startOfDay(now), 89);
      if (waktu === "Custom" && (dateRange.from || dateRange.to)) {
        const from = dateRange.from ? startOfDay(dateRange.from) : null;
        const to = dateRange.to ? endOfDay(dateRange.to) : null;
        if (from && entryDate < from) return false;
        if (to && entryDate > to) return false;
        return true;
      }
      return true;
    },
    [waktu, dateRange, now]
  );

  const filtered = useMemo(() => {
    let base = ENTRIES;
    // cabang from sidebar
    if (cabangFilter && cabangFilter !== "Semua cabang") {
      base = base.filter((e) => e.cabang === cabangFilter || e.cabang === "Semua cabang");
    }
    return base.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${e.actor.name} ${e.action} ${e.resource}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!status.includes(e.outcome)) return false;
      if (aksi !== "Semua" && !e.action.includes(aksi)) return false;
      if (aktorRole !== "Semua" && e.actor.role !== aktorRole) return false;
      if (person !== "Semua" && e.actor.name !== person) return false;
      if (!matchesWaktu(e)) return false;
      return true;
    });
  }, [cabangFilter, search, status, aksi, aktorRole, person, matchesWaktu]);

  const clearAll = () => {
    setSearch("");
    setStatus(["success", "denied", "alert"]);
    setAksi("Semua");
    setAktorRole("Semua");
    setPerson("Semua");
    setWaktu("24 jam terakhir");
    setDateRange({});
  };

  const waktuLabel = (() => {
    if (waktu === "Custom" && (dateRange.from || dateRange.to)) {
      if (dateRange.from && dateRange.to) {
        if (dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear()) {
          return `${format(dateRange.from, "d", { locale: localeId })}–${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
        }
        return `${format(dateRange.from, "d MMM", { locale: localeId })} – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
      }
      if (dateRange.from) return format(dateRange.from, "d MMM yyyy", { locale: localeId });
      if (dateRange.to) return format(dateRange.to, "d MMM yyyy", { locale: localeId });
    }
    return waktu;
  })();

  const availableFilters = [
    ...(status.length === 3 ? ["Status"] : []),
    ...(aksi === "Semua" ? ["Aksi"] : []),
    ...(aktorRole === "Semua" ? ["Aktor"] : []),
    ...(person === "Semua" && aktorRole !== "Semua" ? [] : person === "Semua" ? ["Person"] : []),
    ...(waktu === "24 jam terakhir" && !dateRange.from && !dateRange.to ? [] : []), // Waktu always shown as chip when not default
  ];

  return (
    <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
      {/* Search + chips */}
      <div className="flex flex-col gap-3 border-b p-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="w-full sm:w-[320px]">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <SearchIcon className="size-3.5 opacity-60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Cari aktor, aksi, resource…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Cari audit log"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Hapus pencarian"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          <div className="flex-1 hidden sm:block" />
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} dari {ENTRIES.length} entri{cabangFilter && cabangFilter !== "Semua cabang" ? ` · ${cabangFilter}` : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Filter
          </span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          {/* Status chip - multi */}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={`inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs ${status.length !== 3 ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"}`}
                />
              }
            >
              <span className="px-2 py-1 font-medium">Status</span>
              <span className={`px-2 py-1 font-mono text-[11px] ${status.length !== 3 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                adalah
              </span>
              <span className="flex items-center gap-1 px-2 py-1 font-medium max-w-[140px] truncate">
                {status.length === 3 ? "Semua" : status.map((s) => OUTCOME[s].label).join(", ")}
                <ChevronDownIcon className="size-3 opacity-60" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-3">
              <div className="font-medium text-sm mb-2">Status</div>
              {(Object.keys(OUTCOME) as Outcome[]).map((k) => {
                const Icon = OUTCOME[k].Icon;
                return (
                  <label key={k} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox checked={status.includes(k)} onCheckedChange={() => toggleStatus(k)} />
                    <Icon className="size-3.5 opacity-60" />
                    {OUTCOME[k].label}
                  </label>
                );
              })}
              <div className="flex justify-between mt-3">
                <Button size="xs" variant="ghost" onClick={() => setStatus(["success", "denied", "alert"])}>Reset</Button>
                <Button size="xs" onClick={() => setStatusOpen(false)}>Selesai</Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Aksi chip */}
          <Popover open={aksiOpen} onOpenChange={setAksiOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={`inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs ${aksi !== "Semua" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"}`}
                />
              }
            >
              <span className="px-2 py-1 font-medium">Aksi</span>
              <span className={`px-2 py-1 font-mono text-[11px] ${aksi !== "Semua" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {aksi === "Semua" ? "adalah" : "mengandung"}
              </span>
              <span className="flex items-center gap-1 px-2 py-1 font-medium">
                {aksi}
                <ChevronDownIcon className="size-3 opacity-60" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <Select value={aksi} onValueChange={(v) => { if (v) { setAksi(v); setAksiOpen(false); } }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AKSI_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Aktor chip */}
          <Popover open={aktorOpen} onOpenChange={setAktorOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={`inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs ${aktorRole !== "Semua" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"}`}
                />
              }
            >
              <span className="px-2 py-1 font-medium">Aktor</span>
              <span className={`px-2 py-1 font-mono text-[11px] ${aktorRole !== "Semua" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>adalah</span>
              <span className="flex items-center gap-1 px-2 py-1 font-medium">
                {aktorRole}
                <ChevronDownIcon className="size-3 opacity-60" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <Select value={aktorRole} onValueChange={(v) => { if (v) { setAktorRole(v); setPerson("Semua"); setAktorOpen(false); } }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Person chip - dependent */}
          <Popover open={personOpen} onOpenChange={setPersonOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  disabled={aktorRole === "Semua" && person === "Semua" && availablePersons.length === 0}
                  className={`inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs ${person !== "Semua" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"} disabled:opacity-50`}
                />
              }
            >
              <span className="px-2 py-1 font-medium">Person</span>
              <span className={`px-2 py-1 font-mono text-[11px] ${person !== "Semua" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>adalah</span>
              <span className="flex items-center gap-1 px-2 py-1 font-medium max-w-[120px] truncate">
                {person}
                <ChevronDownIcon className="size-3 opacity-60" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {aktorRole === "Semua" ? "Semua person" : `Person dengan role ${aktorRole}`}
              </div>
              <Select value={person} onValueChange={(v) => { if (v) { setPerson(v); setPersonOpen(false); } }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua</SelectItem>
                  {availablePersons.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {aktorRole === "Semua" && <div className="px-2 pt-2 text-[11px] text-muted-foreground">Pilih Aktor dulu untuk filter person spesifik.</div>}
            </PopoverContent>
          </Popover>

          {/* Waktu chip */}
          <Popover open={waktuOpen} onOpenChange={setWaktuOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={`inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs ${waktu !== "24 jam terakhir" || dateRange.from || dateRange.to ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"}`}
                />
              }
            >
              <span className="px-2 py-1 font-medium">Waktu</span>
              <span className={`px-2 py-1 font-mono text-[11px] ${waktu !== "24 jam terakhir" || dateRange.from || dateRange.to ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>dalam</span>
              <span className="flex items-center gap-1 px-2 py-1 font-medium max-w-[160px] truncate">
                {waktuLabel}
                <ChevronDownIcon className="size-3 opacity-60" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="p-2">
                <Select value={waktu} onValueChange={(v) => { if (v) { const nv = v as WaktuPreset; setWaktu(nv); if (nv !== "Custom") setDateRange({}); } }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAKTU_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {waktu === "Custom" && (
                <div className="border-t p-2">
                  <Calendar
                    mode="range"
                    selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                    onSelect={(range) => {
                      if (!range) setDateRange({});
                      else setDateRange({ from: range.from, to: range.to });
                    }}
                    numberOfMonths={1}
                  />
                  <div className="flex justify-between mt-2">
                    <Button size="xs" variant="ghost" onClick={() => setDateRange({})}>Reset</Button>
                    <Button size="xs" onClick={() => setWaktuOpen(false)}>Tutup</Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger
              render={<Button size="xs" variant="ghost" className="border-dashed" />}
            >
              <PlusIcon />
              Tambah
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-2">
              <div className="text-xs font-medium mb-2">Tambah filter</div>
              <div className="flex flex-col gap-1">
                {status.length === 3 && (
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { setStatus(["success"]); setAddOpen(false); }}>
                    <CircleCheckIcon className="size-3" /> Status
                  </Button>
                )}
                {aksi === "Semua" && (
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { setAksi("servis"); setAddOpen(false); }}>
                    <WrenchIcon className="size-3" /> Aksi
                  </Button>
                )}
                {aktorRole === "Semua" && (
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { setAktorRole("Teknisi"); setAddOpen(false); }}>
                    <ShieldIcon className="size-3" /> Aktor
                  </Button>
                )}
                {person === "Semua" && (
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { const p = availablePersons[0]; if (p) setPerson(p); setAddOpen(false); }}>
                    <SearchIcon className="size-3" /> Person
                  </Button>
                )}
                <Button size="xs" variant="ghost" className="justify-start" onClick={() => { setWaktu("7d"); setAddOpen(false); }}>
                  <CalendarIcon className="size-3" /> Waktu
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button size="xs" variant="ghost" className="text-muted-foreground shrink-0" onClick={clearAll}>
            <XIcon />
            Hapus semua
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4 w-32">Waktu</TableHead>
              <TableHead>Aktor</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Cabang / Perangkat</TableHead>
              <TableHead className="pe-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Tidak ada log untuk filter aktif
                  <button type="button" onClick={clearAll} className="ml-2 underline underline-offset-2 hover:text-foreground">Hapus filter</button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e, i) => {
                const o = OUTCOME[e.outcome];
                return (
                  <TableRow
                    key={`${e.ts}-${e.date}-${i}`}
                    className={
                      e.outcome === "alert"
                        ? "bg-destructive/[0.04]"
                        : undefined
                    }
                  >
                    <TableCell className="ps-4 font-mono text-muted-foreground text-xs tabular-nums">
                      <div>{e.date}</div>
                      <div>{e.ts}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className={"size-6 " + e.actor.tone}>
                          <AvatarFallback className="bg-transparent font-medium text-[10px]">
                            {e.actor.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm leading-none truncate">{e.actor.name}</div>
                          <div className="text-[11px] text-muted-foreground">{e.actor.role}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.action}</TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs max-w-[220px] truncate">
                      {e.resource}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs truncate max-w-[160px]">{e.cabang}</div>
                      <div className="text-muted-foreground text-xs truncate max-w-[160px]">{e.device}</div>
                    </TableCell>
                    <TableCell className="pe-4">
                      <Badge variant="outline" className={"gap-1.5 " + o.cls}>
                        <o.Icon className="size-3" />
                        {o.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t p-3 text-muted-foreground text-xs">
        <span>{filtered.length} dari {ENTRIES.length} entri · {activeCount} filter aktif{cabangFilter && cabangFilter !== "Semua cabang" ? ` · cabang: ${cabangFilter}` : ""} · auto-refresh 30 dtk</span>
        <Button size="xs" variant="ghost">Muat lebih lama →</Button>
      </div>
    </div>
  );
}

function Chip({ chip, onRemove, onValueClick }: { chip: { field: string; op: string; value: string; tone?: string }; onRemove?: () => void; onValueClick?: () => void }) {
  const tone =
    chip.tone === "include"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : chip.tone === "exclude"
        ? "border-destructive/30 bg-destructive/5"
        : "border-border bg-background";
  const opTone =
    chip.tone === "include"
      ? "text-emerald-700 dark:text-emerald-400"
      : chip.tone === "exclude"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className={"inline-flex items-center divide-x divide-border overflow-hidden rounded-md border text-xs " + tone}>
      <span className="px-2 py-1 font-medium">{chip.field}</span>
      <span className={"px-2 py-1 font-mono text-[11px] " + opTone}>{chip.op}</span>
      <button
        type="button"
        onClick={onValueClick}
        className="flex items-center gap-1 px-2 py-1 hover:bg-accent/60"
      >
        <span className="font-medium">{chip.value}</span>
        <ChevronDownIcon className="size-3 opacity-60" />
      </button>
      <button
        type="button"
        aria-label={`Hapus filter ${chip.field}`}
        onClick={onRemove}
        className="flex items-center px-1.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}
