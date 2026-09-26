"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, subHours, subDays, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ShieldIcon, WrenchIcon, XIcon, SearchIcon, CalendarIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditLog } from "@/app/app/audit-log/actions";
import {
  auditActionLabel,
  auditActionsFrom,
  auditInitials,
  filterAuditRows,
  type AuditRow,
} from "@/lib/operational/audit-log";

type WaktuPreset = "24 jam terakhir" | "Hari ini" | "7d" | "30d" | "90d" | "Custom";

const WAKTU_OPTIONS: WaktuPreset[] = ["24 jam terakhir", "Hari ini", "7d", "30d", "90d", "Custom"];

const TONES = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
];

function toneFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index)) % TONES.length;
  return TONES[hash];
}

const ROLE_LABEL: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  ADMIN: "Admin",
  FRONTLINER: "Frontliner",
  TECHNICIAN: "Teknisi",
  TEKNISI: "Teknisi",
};

export function CerviseAuditLogTable({ cabangFilter }: { cabangFilter?: string } = {}) {
  const router = useRouter();

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [waktu, setWaktu] = useState<WaktuPreset>("24 jam terakhir");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [actions, setActions] = useState<string[]>([]);
  const [actorId, setActorId] = useState<string>("Semua");

  useEffect(() => {
    let cancelled = false;
    getAuditLog()
      .then((data) => {
        if (!cancelled) setRows(data.rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Gagal memuat audit log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);

  const timeWindow = useMemo(() => {
    if (waktu === "24 jam terakhir") return { from: subHours(now, 24) as Date | undefined, to: now as Date | undefined };
    if (waktu === "Hari ini") return { from: startOfDay(now) as Date | undefined, to: endOfDay(now) as Date | undefined };
    if (waktu === "7d") return { from: subDays(startOfDay(now), 6) as Date | undefined, to: now as Date | undefined };
    if (waktu === "30d") return { from: subDays(startOfDay(now), 29) as Date | undefined, to: now as Date | undefined };
    if (waktu === "90d") return { from: subDays(startOfDay(now), 89) as Date | undefined, to: now as Date | undefined };
    if (dateRange.from || dateRange.to) {
      return {
        from: dateRange.from ? startOfDay(dateRange.from) : undefined,
        to: dateRange.to ? endOfDay(dateRange.to) : undefined,
      };
    }
    return { from: undefined, to: undefined };
  }, [waktu, dateRange, now]);

  const actionOptions = useMemo(() => auditActionsFrom(rows), [rows]);
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) if (row.actorId) seen.set(row.actorId, row.actorName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const scoped = useMemo(() => {
    if (!cabangFilter || cabangFilter === "Semua cabang") return rows;
    return rows.filter((row) => row.branchName === cabangFilter);
  }, [rows, cabangFilter]);

  const filtered = useMemo(
    () =>
      filterAuditRows(scoped, {
        search,
        actions,
        actorIds: actorId === "Semua" ? undefined : [actorId],
        from: timeWindow.from,
        to: timeWindow.to,
      }),
    [scoped, search, actions, actorId, timeWindow],
  );

  // Keep the time range shareable, same as the other tables in this app.
  useEffect(() => {
    const params = new URLSearchParams();
    if (waktu !== "24 jam terakhir") params.set("waktu", waktu);
    if (waktu === "Custom" && (dateRange.from || dateRange.to)) {
      if (dateRange.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [waktu, dateRange, router]);

  const clearAll = () => {
    setSearch("");
    setWaktu("24 jam terakhir");
    setDateRange({});
    setActions([]);
    setActorId("Semua");
  };

  const activeCount =
    (search ? 1 : 0) +
    (actions.length > 0 ? 1 : 0) +
    (actorId !== "Semua" ? 1 : 0) +
    (waktu !== "24 jam terakhir" || dateRange.from || dateRange.to ? 1 : 0);

  const waktuLabel = (() => {
    if (waktu === "Custom" && (dateRange.from || dateRange.to)) {
      if (dateRange.from && dateRange.to) return `${format(dateRange.from, "d MMM", { locale: localeId })} – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
      if (dateRange.from) return format(dateRange.from, "d MMM yyyy", { locale: localeId });
      if (dateRange.to) return format(dateRange.to, "d MMM yyyy", { locale: localeId });
    }
    return waktu;
  })();

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg">
            <ShieldIcon className="size-4 text-muted-foreground" />
            Jejak aktivitas
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <WrenchIcon className="size-3.5" />
            {loading ? "Memuat…" : `${filtered.length} dari ${scoped.length} catatan`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="h-8 w-full bg-background sm:max-w-xs">
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-3.5 opacity-60" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Cari aktor, aksi, detail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="text-sm"
          />
          {search ? (
            <InputGroupAddon align="inline-end">
              <button type="button" onClick={() => setSearch("")} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <XIcon className="size-3.5" />
              </button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <Select
          value={actions[0] ?? "Semua"}
          onValueChange={(value) => setActions(value && value !== "Semua" ? [value] : [])}
        >
          <SelectTrigger size="sm" className="w-[180px] shrink-0 bg-background">
            <SelectValue placeholder="Aksi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Semua">Semua aksi</SelectItem>
            {actionOptions.map((action) => (
              <SelectItem key={action} value={action}>
                {auditActionLabel(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actorId} onValueChange={(value) => setActorId(value ?? "Semua")}>
          <SelectTrigger size="sm" className="w-[180px] shrink-0 bg-background">
            <SelectValue placeholder="Aktor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Semua">Semua aktor</SelectItem>
            {actorOptions.map((actor) => (
              <SelectItem key={actor.id} value={actor.id}>
                {actor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" size="filter" className="w-auto shrink-0 justify-start gap-2 font-normal text-sm" />}
          >
            <CalendarIcon className="size-4 opacity-70" />
            <span className="truncate">{waktuLabel}</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <div className="flex flex-wrap gap-1 border-b p-2">
              {WAKTU_OPTIONS.filter((option) => option !== "Custom").map((option) => (
                <Button key={option} size="xs" variant={waktu === option ? "secondary" : "ghost"} onClick={() => { setWaktu(option); setDateRange({}); }}>
                  {option}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => {
                setDateRange({ from: range?.from, to: range?.to });
                setWaktu("Custom");
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {activeCount > 0 ? (
          <button type="button" onClick={clearAll} className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted">
            <XIcon className="size-3" /> Hapus filter
          </button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Waktu</TableHead>
              <TableHead>Aktor</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Cabang</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat audit log…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {scoped.length === 0
                    ? "Belum ada aktivitas tercatat"
                    : "Tidak ada catatan untuk filter ini"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {format(new Date(row.createdAt), "d MMM yyyy HH:mm:ss", { locale: localeId })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className={"size-6 shrink-0 " + (row.actorId ? toneFor(row.actorName) : "bg-muted text-muted-foreground")}>
                        <AvatarFallback className="bg-transparent text-[10px] font-medium">{auditInitials(row.actorName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{row.actorName}</div>
                        {row.actorRole ? (
                          <div className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[row.actorRole] ?? row.actorRole}</div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" size="sm" className="whitespace-nowrap">
                      {row.actionLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs text-muted-foreground" title={row.resource}>
                    {row.resource}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.branchName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
