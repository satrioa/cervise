"use client";

import { useMemo, useState } from "react";
import { ScanBarcodeIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PTabs10 } from "@/components/p-tabs-10";
import { cn } from "@/lib/utils";
import {
  computeVariance,
  opnameVarianceBar,
  type OpnameLineDraft,
} from "@/lib/operational/stock-opname";

type CountLine = OpnameLineDraft & { id: string };

export function OpnameCountPanel({
  lines,
  readOnly,
  onCount,
  onReview,
  onScan,
}: {
  lines: CountLine[];
  readOnly: boolean;
  onCount: (line: CountLine, value: number) => void;
  onReview: () => void;
  onScan: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.countedQty])),
  );
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(
    () => {
      const term = search.trim().toLowerCase();
      return lines.filter((line) => {
        const value = values[line.id] ?? 0;
        if (filter === "pending" && value !== 0) return false;
        if (filter === "diff" && value - line.snapshotQty === 0) return false;
        if (!term) return true;
        return `${line.name} ${line.sku} ${line.imei ?? ""}`.toLowerCase().includes(term);
      });
    },
    [lines, values, filter, search],
  );

  const counted = lines.filter((l) => (values[l.id] ?? 0) > 0).length;
  const pendingCount = lines.filter((l) => (values[l.id] ?? 0) === 0).length;
  const diffCount = lines.filter((l) => (values[l.id] ?? 0) - l.snapshotQty !== 0).length;
  const percent = lines.length === 0 ? 0 : Math.round((counted / lines.length) * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-56 shrink-0 items-center gap-3">
            <span className="whitespace-nowrap text-sm font-medium tabular-nums" aria-live="polite">
              {counted} / {lines.length} terhitung
            </span>
            <Progress value={percent} className="h-2 flex-1" aria-label="Progres hitung stok" />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56 shrink-0">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama / SKU / IMEI"
                aria-label="Cari barang opname"
                className="h-8 pl-8"
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={onScan} disabled={readOnly} className="shrink-0">
              <ScanBarcodeIcon data-icon="inline-start" />
              Scan
            </Button>
          </div>
        </div>
        <PTabs10
          value={filter}
          onValueChange={setFilter}
          items={[
            { value: "all", label: "Semua", count: lines.length },
            { value: "pending", label: "Belum", count: pendingCount },
            { value: "diff", label: "Selisih", count: diffCount },
          ]}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_3rem_4rem_minmax(9rem,1fr)] gap-2 border-b pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Items</span>
        <span className="text-center">Sistem</span>
        <span className="text-right">Fisik</span>
        <span />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((line) => {
          const value = values[line.id] ?? 0;
          const delta = value - line.snapshotQty;
          const bar = opnameVarianceBar(value, line.snapshotQty);
          const barColor =
            bar.tone === "empty"
              ? "bg-white"
              : bar.tone === "short"
                ? "bg-red-500"
                : bar.tone === "match"
                  ? "bg-emerald-500"
                  : "bg-yellow-400";
          return (
            <div
              key={line.id}
              className="grid grid-cols-[minmax(0,1fr)_3rem_4rem_minmax(9rem,1fr)] items-center gap-2 rounded-xl border p-3 data-[diff=true]:border-primary/40"
              data-diff={delta !== 0}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {line.sku}
                  {line.imei ? ` · IMEI ${line.imei}` : ""}
                </p>
              </div>
              <div className="text-center font-mono text-xs tabular-nums">
                {line.snapshotQty}
              </div>
              <div className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {value}/{line.snapshotQty}
                {delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="h-2 min-w-0 flex-1 overflow-hidden rounded-full border bg-muted"
                  role="progressbar"
                  aria-label={`Selisih ${line.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(bar.percent)}
                >
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${bar.percent}%` }}
                  />
                </div>
                <NumberField
                  value={value}
                  min={0}
                  onValueChange={(next) => setValues((v) => ({ ...v, [line.id]: next ?? 0 }))}
                  className="w-24 shrink-0"
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement disabled={readOnly} />
                    <NumberFieldInput
                      inputMode="numeric"
                      aria-label={`Qty fisik ${line.name}`}
                      disabled={readOnly}
                      onBlur={() => onCount(line, values[line.id] ?? 0)}
                    />
                    <NumberFieldIncrement disabled={readOnly} />
                  </NumberFieldGroup>
                </NumberField>
              </div>
            </div>
          );
        })}
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada baris sesuai filter.
          </p>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="sticky bottom-0 flex gap-2 border-t bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" className="flex-1" onClick={onReview} disabled={counted === 0}>
            Tinjau &amp; Posting
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type { CountLine };
export { computeVariance };
