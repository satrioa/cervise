"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { PackageIcon } from "lucide-react";
import type { ProductRow } from "@/app/app/penjualan/actions";

function stockTone(stock: number) {
  if (stock === 0) return { label: "Habis", cls: "border-destructive/30 text-destructive", barCls: "bg-destructive" };
  if (stock < 10) return { label: "Menipis", cls: "border-amber-500/30 text-amber-700", barCls: "bg-amber-500" };
  return { label: "Tersedia", cls: "border-emerald-500/30 text-emerald-700", barCls: "bg-emerald-500" };
}

function groupByParentKey(products: ProductRow[]): { parent: ProductRow; variants: ProductRow[]; key: string }[] {
  const map = new Map<string, ProductRow[]>();
  for (const p of products) {
    const k = p.parent_key && p.parent_key.trim() !== "" ? p.parent_key : p.name;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  const groups: { parent: ProductRow; variants: ProductRow[]; key: string }[] = [];
  for (const [k, arr] of map) {
    const parent = arr.find((r) => (r.parent_key && r.parent_key.trim() !== "" ? r.parent_key === k : r.name === k)) ?? arr[0];
    groups.push({ parent, variants: arr, key: k });
  }
  return groups;
}

function VariantCard({ group, onAdd }: { group: { parent: ProductRow; variants: ProductRow[]; key: string }; onAdd: (p: ProductRow) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [selWarna, setSelWarna] = useState<string | null>(null);
  const [selStorage, setSelStorage] = useState<string | null>(null);
  const parent = group.parent;
  const totalStock = group.variants.reduce((s, v) => s + (v.stock_qty ?? 0), 0);
  const price = Math.min(...group.variants.map((v) => v.price ?? 0));
  const disabled = totalStock === 0;
  const isBekas = (parent as { variant_type?: string }).variant_type === "BEKAS";
  const warnaOpts = Array.from(new Set(group.variants.map((v) => v.warna).filter(Boolean) as string[]));
  const storageOpts = Array.from(new Set(group.variants.map((v) => v.storage).filter(Boolean) as string[]));
  const selectedVariant = group.variants.find((v) => (selWarna == null || v.warna === selWarna) && (selStorage == null || v.storage === selStorage)) ?? group.variants[0];
  const canAdd = (selWarna != null || warnaOpts.length === 0) && (selStorage != null || storageOpts.length === 0) && selectedVariant && selectedVariant.stock_qty > 0;

  return (
    <div className="flex flex-col gap-1">
      <button
              type="button"
              onClick={() => !disabled && setExpanded((e) => !e)}
              disabled={disabled}
              className="text-left flex flex-row gap-2.5 items-center rounded-xl border bg-card p-2.5 shadow-xs/5 hover:bg-muted/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className={`flex size-14 shrink-0 items-center justify-center rounded-lg border ${isBekas ? "bg-amber-500/15 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                <PackageIcon className={`size-5 ${isBekas ? "text-amber-600" : "text-emerald-600/70"}`} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[13px] leading-tight">{parent.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{parent.sku}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" size="sm" className={stockTone(totalStock).cls + " text-[10px] px-1 py-0"}>{stockTone(totalStock).label}</Badge>
                    <Badge variant="secondary" size="sm" className="font-mono text-[10px] px-1 py-0">{isBekas ? "Bekas" : "Baru"}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[13px] font-semibold tabular-nums">{formatCurrencyPlain(price)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">Stok {totalStock}</span>
                </div>
              </div>
            </button>

            {expanded && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setExpanded(false)}>
                <div className="relative w-full max-w-sm rounded-2xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${isBekas ? "bg-amber-500/15 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                    <PackageIcon className={`size-5 ${isBekas ? "text-amber-600" : "text-emerald-600/70"}`} />
                  </div>
                  <div>
                    <div className="font-medium text-sm leading-snug">{parent.name}</div>
                    <div className="text-[11px] text-muted-foreground">{parent.sku}</div>
                  </div>
                </div>
                {warnaOpts.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Warna</div>
                    <div className="flex flex-wrap gap-1.5">
                      {warnaOpts.map((w) => (
                        <button key={w} type="button" onClick={() => setSelWarna(w === selWarna ? null : w)} className={`rounded-xl px-3.5 py-1.5 text-sm font-medium border transition-colors ${w === selWarna ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border hover:border-amber-500/50 text-foreground"}`}>{w}</button>
                      ))}
                    </div>
                  </div>
                )}
                {storageOpts.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Storage</div>
                    <div className="flex flex-wrap gap-1.5">
                      {storageOpts.map((s) => (
                        <button key={s} type="button" onClick={() => setSelStorage(s === selStorage ? null : s)} className={`rounded-xl px-3.5 py-1.5 text-sm font-medium border transition-colors ${s === selStorage ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border hover:border-amber-500/50 text-foreground"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" disabled={!canAdd} onClick={() => { if (canAdd && selectedVariant) { onAdd(selectedVariant); setExpanded(false); } }} className="w-full rounded-xl bg-amber-500 text-white font-medium py-2 text-[13px] disabled:opacity-40 hover:bg-amber-600 transition-colors">Tambah ke keranjang</button>
                </div>
              </div>
            )}
          </div>
        );
}

export function PenjualanProductGrid({ products, onAdd }: { products: ProductRow[]; onAdd: (p: ProductRow) => void }) {
  if (products.length === 0) {
    return <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">Tidak ada produk — tambah di Inventori</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {groupByParentKey(products).map((g) => <VariantCard key={g.key} group={g} onAdd={onAdd} />)}
    </div>
  );
}