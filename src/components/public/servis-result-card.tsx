import { Badge } from "@/components/ui/badge";
import type { GaransiState } from "@/lib/operational/garansi-meta";
import { StageTrack } from "@/lib/operational/stage-track";
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

          <StageTrack stage={result.status} />

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
          <ol className="mt-3 space-y-2">
            {result.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  {entry.from ? <span className="text-muted-foreground">{entry.from} → </span> : null}
                  <span className="font-medium">{entry.to ?? "—"}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatDateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
