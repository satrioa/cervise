"use client";

import { useMemo, useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { computeVariance, type OpnameLineDraft } from "@/lib/operational/stock-opname";

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

  const visible = useMemo(
    () =>
      lines.filter((line) => {
        const value = values[line.id] ?? 0;
        if (filter === "pending") return value === 0;
        if (filter === "diff") return value - line.snapshotQty !== 0;
        return true;
      }),
    [lines, values, filter],
  );

  const counted = lines.filter((l) => (values[l.id] ?? 0) > 0).length;
  const percent = lines.length === 0 ? 0 : Math.round((counted / lines.length) * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium tabular-nums" aria-live="polite">
            {counted} / {lines.length} terhitung
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onScan} disabled={readOnly}>
            <ScanBarcodeIcon data-icon="inline-start" />
            Scan
          </Button>
        </div>
        <Progress value={percent} aria-label="Progres hitung stok" />
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => {
            const next = v[0];
            if (next) setFilter(next);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">Semua</ToggleGroupItem>
          <ToggleGroupItem value="pending">Belum</ToggleGroupItem>
          <ToggleGroupItem value="diff">Selisih</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((line) => {
          const value = values[line.id] ?? 0;
          const delta = value - line.snapshotQty;
          return (
            <div
              key={line.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border p-3 data-[diff=true]:border-primary/40"
              data-diff={delta !== 0}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {line.sku}
                  {line.imei ? ` · IMEI ${line.imei}` : ""}
                </p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Sistem: {line.snapshotQty}
                </p>
              </div>
              <NumberField
                value={value}
                min={0}
                onValueChange={(next) => setValues((v) => ({ ...v, [line.id]: next ?? 0 }))}
                className="w-32 shrink-0"
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
              <Badge variant={delta === 0 ? "secondary" : delta < 0 ? "destructive" : "default"}>
                <span aria-hidden>{delta > 0 ? "+" : ""}</span>
                <span className="tabular-nums">{delta}</span>
              </Badge>
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
