"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { PackageIcon } from "lucide-react";
import type { ProductRow } from "@/app/app/penjualan/actions";

function stockTone(stock: number) {
  if (stock === 0) return { label: "Habis", cls: "border-destructive/30 text-destructive", barCls: "bg-destructive" };
  if (stock < 10) return { label: "Menipis", cls: "border-amber-500/30 text-amber-700", barCls: "bg-amber-500" };
  return { label: "Tersedia", cls: "border-emerald-500/30 text-emerald-700", barCls: "bg-emerald-500" };
}

export function PenjualanProductGrid({ products, onAdd }: { products: ProductRow[]; onAdd: (p: ProductRow) => void }) {
  if (products.length === 0) {
    return <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">Tidak ada produk — tambah di Inventory</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const tone = stockTone(p.stock_qty);
        const disabled = p.stock_qty === 0;
        return (
          <button key={p.id} type="button" onClick={() => !disabled && onAdd(p)} disabled={disabled} className="text-left rounded-xl border bg-card p-3 shadow-xs/5 hover:bg-muted/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col gap-2">
            <div className="flex size-28 items-center justify-center rounded-lg border border-border bg-muted/30">
              <PackageIcon className="size-8 text-muted-foreground/50" />
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1"><div className="truncate font-medium text-sm leading-tight">{p.name}</div><div className="font-mono text-[11px] text-muted-foreground truncate">{p.sku}</div></div>
              <Badge variant="outline" size="sm" className={tone.cls}>{tone.label}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrencyPlain(p.price)}</span>
              <Badge variant="secondary" size="sm" className="font-mono text-[10px]">{p.category}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}