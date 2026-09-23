import { Badge } from "@/components/ui/badge";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { stockTone, type SparepartRow } from "./stock-tone";
import { InventoryContextMenu } from "./inventory-context-menu";

export function InventoryGrid({ rows }: { rows: SparepartRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center text-sm text-muted-foreground">
        Tidak ada sparepart yang cocok
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => {
        const tone = stockTone(p);
        const pct = Math.min(100, Math.round((p.stock / p.capacity) * 100));
        return (
          <InventoryContextMenu key={p.sku} item={p}>
          <div className="rounded-xl border bg-card p-4 shadow-xs/5 cursor-context-menu">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-muted-foreground text-xs">{p.variant}</div>
              </div>
              <Badge variant="outline" size="sm" className={tone.cls}>
                {tone.label}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{p.sku}</span>
              <Badge variant="secondary" className="text-[11px]">{p.category}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={"h-full " + tone.barCls} style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-xs tabular-nums">
                {p.stock}
                <span className="text-muted-foreground/60">/{p.capacity}</span>
              </span>
            </div>
            <div className="mt-2 text-right font-mono text-sm tabular-nums">
              {formatCurrencyPlain(p.price)}
            </div>
          </div>
          </InventoryContextMenu>
        );
      })}
    </div>
  );
}