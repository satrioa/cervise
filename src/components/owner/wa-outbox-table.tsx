"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type OutboxRow = {
  id: string;
  createdAt: string;
  sentAt: string | null;
  event: string;
  toKind: string;
  toStatus: string | null;
  state: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  providerMessageId: string | null;
  dedupeKey: string;
  tenant: string;
  branch: string;
  payload: Record<string, unknown> | null;
};

const STATES = ["pending", "sent", "failed", "skipped"] as const;
const EVENTS = ["servis_created", "servis_status", "shift_opened", "shift_closed"] as const;

const tanggal = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "—";

function stateVariant(state: string) {
  if (state === "sent") return "success" as const;
  if (state === "pending") return "warning" as const;
  if (state === "failed") return "destructive" as const;
  return "outline" as const;
}

function buildUrl(next: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== "" && value !== 0) params.set(key, String(value));
  }
  const query = params.toString();
  return `/owner/notifications${query ? `?${query}` : ""}`;
}

export function WaOutboxTable({
  rows,
  total,
  page,
  pageSize,
  state,
  event,
  q,
  stateCounts,
}: {
  rows: OutboxRow[];
  total: number;
  page: number;
  pageSize: number;
  state: string;
  event: string;
  q: string;
  stateCounts: { state: string; count: number }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const go = (next: Record<string, string | number>) => {
    window.location.assign(
      buildUrl({
        state: next.state ?? state,
        event: next.event ?? event,
        q: next.q ?? q,
        page: next.page ?? page,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATES.map((key) => {
          const count = stateCounts.find((s) => s.state === key)?.count ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go({ state: state === key ? "" : key, page: 1 })}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors hover:bg-accent/50",
                state === key && "border-primary bg-primary/5",
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{key}</div>
              <div className="mt-1 font-heading text-2xl tabular-nums">{count}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3">
          <CardTitle className="text-base">Riwayat pesan</CardTitle>
          <form
            method="get"
            action="/owner/notifications"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative min-w-48 flex-1">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 opacity-60" />
              <Input name="q" defaultValue={q} placeholder="Cari dedupe key / wamid / error" className="pl-8" />
            </div>
            <select
              name="state"
              defaultValue={state}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Filter status"
            >
              <option value="">Semua status</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              name="event"
              defaultValue={event}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Filter event"
            >
              <option value="">Semua event</option>
              {EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <Button type="submit" size="sm">Terapkan</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => go({ state: "", event: "", q: "", page: 1 })}>
              <RefreshCwIcon className="size-3.5" /> Reset
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Waktu</TableHead>
                  <TableHead>Tenant · Cabang</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error / wamid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded((current) => (current === row.id ? null : row.id))}
                    >
                      <TableCell>
                        <ChevronDownIcon className={cn("size-4 transition-transform", expanded === row.id && "rotate-180")} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">{tanggal(row.createdAt)}</TableCell>
                      <TableCell className="max-w-48">
                        <div className="truncate text-sm">{row.tenant}</div>
                        <div className="truncate text-xs text-muted-foreground">{row.branch}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.event}</TableCell>
                      <TableCell className="text-xs">{row.toKind}{row.toStatus ? ` · ${row.toStatus}` : ""}</TableCell>
                      <TableCell><Badge variant={stateVariant(row.state)}>{row.state}</Badge></TableCell>
                      <TableCell className="tabular-nums">{row.attempts}</TableCell>
                      <TableCell className="max-w-56">
                        <div className="truncate font-mono text-xs" title={row.lastError ?? row.providerMessageId ?? ""}>
                          {row.lastError ?? row.providerMessageId ?? "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded === row.id ? (
                      <TableRow key={`${row.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            <div><dt className="font-mono uppercase tracking-widest text-muted-foreground">Dedupe key</dt><dd className="mt-0.5 break-all font-mono">{row.dedupeKey}</dd></div>
                            <div><dt className="font-mono uppercase tracking-widest text-muted-foreground">Next attempt</dt><dd className="mt-0.5">{tanggal(row.nextAttemptAt)}</dd></div>
                            <div><dt className="font-mono uppercase tracking-widest text-muted-foreground">Dikirim</dt><dd className="mt-0.5">{tanggal(row.sentAt)}</dd></div>
                            <div><dt className="font-mono uppercase tracking-widest text-muted-foreground">wamid</dt><dd className="mt-0.5 break-all font-mono">{row.providerMessageId ?? "—"}</dd></div>
                            <div><dt className="font-mono uppercase tracking-widest text-muted-foreground">Error</dt><dd className="mt-0.5 break-all">{row.lastError ?? "—"}</dd></div>
                            <div className="sm:col-span-2 lg:col-span-3"><dt className="font-mono uppercase tracking-widest text-muted-foreground">Payload</dt><dd className="mt-0.5 break-all font-mono">{JSON.stringify(row.payload)}</dd></div>
                          </dl>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Tidak ada pesan yang cocok.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{total} pesan · halaman {page} dari {pageCount}</span>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => go({ page: next })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
