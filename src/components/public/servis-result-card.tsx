"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Stepper, StepperItem } from "@/components/stepper";
import type { GaransiState } from "@/lib/operational/garansi-meta";
import { STAGES, stageIndex, type Stage } from "@/lib/operational/stage-track";
import { formatTrackingCode, type PublicServisResult } from "@/lib/public/lookup";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const GARANSI_TONE: Record<GaransiState, { bar: string; chip: string; label: string }> = {
  belum_aktif: { bar: "bg-muted-foreground/40", chip: "border-muted-foreground/30 text-muted-foreground", label: "Belum aktif" },
  aktif: { bar: "bg-emerald-500", chip: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400", label: "Aktif" },
  warning: { bar: "bg-amber-500", chip: "border-amber-500/30 text-amber-700 dark:text-amber-400", label: "Segera berakhir" },
  segera_habis: { bar: "bg-amber-500", chip: "border-amber-500/30 text-amber-700 dark:text-amber-400", label: "Segera habis" },
  expired: { bar: "bg-destructive", chip: "border-destructive/30 text-destructive", label: "Kedaluwarsa" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "d MMM yyyy", { locale: localeId });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "d MMM yyyy HH:mm", { locale: localeId });
}

/**
 * Strip status horizontal: semua tahapan servis ditampilkan, tahap aktif
 * berada di tengah (strip digeser ke posisi aktif) dan teks panjang di
 *-clip dengan efek fade di kiri dan kanan.
 */
function StatusStrip({ stage }: { stage: Stage }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const current = stageIndex(stage);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[data-status="active"]');
    if (!strip || !active) return;
    strip.scrollLeft = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
  }, [stage]);

  return (
    <div
      ref={stripRef}
      data-stage-strip
      className="overflow-x-auto scrollbar-none rounded-xl border bg-muted/40 p-3"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)",
      }}
    >
      <Stepper orientation="horizontal" className="w-max min-w-full">
        {STAGES.map((entry, index) => (
          <StepperItem
            key={entry.key}
            title={entry.label}
            status={index === current ? "active" : index < current ? "completed" : "default"}
          />
        ))}
      </Stepper>
    </div>
  );
}

export function ServisResultCard({ result }: { result: PublicServisResult }) {
  const tone = GARANSI_TONE[result.garansi.state];
  const garansiLabel =
    result.garansi.state === "belum_aktif" || result.garansi.daysLeft === null
      ? tone.label
      : result.garansi.daysLeft < 0
        ? tone.label
        : `${result.garansi.daysLeft} hari`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card shadow-xs/5">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Status service</span>
              <h2 className="mt-1 truncate font-heading text-xl tracking-tight">{result.device}</h2>
            </div>
            <Badge variant="outline" size="sm" className="font-mono text-[10px]">
              {result.status}
            </Badge>
          </div>

          <StatusStrip stage={result.status} />

          <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">No. service</dt>
              <dd className="truncate font-mono text-xs">{result.serviceNumber ?? "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Kode cek</dt>
              <dd className="truncate font-mono text-xs">{formatTrackingCode(result.trackingCode)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Masuk</dt>
              <dd className="truncate text-xs">{formatDate(result.createdAt)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cabang</dt>
              <dd className="truncate text-xs">{result.branchName}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Teknisi</dt>
              <dd className="truncate text-xs">{result.teknisiName ?? "Belum ditugaskan"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-xs/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Garansi</span>
          <Badge variant="outline" size="sm" className={`font-mono text-[10px] ${tone.chip}`}>
            {garansiLabel}
          </Badge>
        </div>

        <p className="mt-2 font-heading text-2xl tracking-tight">
          {result.garansi.state === "expired" ? "Kedaluwarsa" : result.garansiUntil ? formatDate(result.garansiUntil) : "Belum aktif"}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${tone.bar}`} style={{ width: `${result.garansi.pct}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-xs tabular-nums">{result.garansi.pct}%</span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {result.garansi.state === "belum_aktif"
            ? "Garansi akan aktif setelah unit diterima dan disetujui."
            : result.garansi.state === "expired"
              ? `Kedaluwarsa pada ${formatDate(result.garansiUntil)}. Periksa kembali dengan teknisi.`
              : `Berlaku sampai ${formatDate(result.garansiUntil)} · total ${result.garansi.total} hari.`}
        </p>
      </div>

      {result.history.length > 0 ? (
        <div className="rounded-2xl border bg-card p-5 shadow-xs/5">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Riwayat status</span>
          <Stepper orientation="vertical" className="mt-3">
            {result.history.map((entry, index) => (
              <StepperItem
                key={`${entry.at}-${index}`}
                title={entry.from ? `${entry.from} → ${entry.to ?? "—"}` : (entry.to ?? "—")}
                description={formatDateTime(entry.at)}
                status={index === result.history.length - 1 ? "active" : "completed"}
              />
            ))}
          </Stepper>
        </div>
      ) : null}
    </div>
  );
}
