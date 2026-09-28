"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrencyPlain } from "@/lib/format";
import {
  ChevronRightIcon,
  LayoutGridIcon,
  PackageIcon,
  Rows3Icon,
  SmartphoneIcon,
} from "lucide-react";
import {
  toInventoryTableRows,
  variantLabel,
  type InventoryGroup,
  type InventoryProduct,
  type InventorySummary,
} from "@/lib/operational/inventori";

type View = "kartu" | "tabel";

function stockBadgeClass(stock: number): string {
  if (stock <= 0) return "border-destructive text-destructive";
  if (stock < 3) return "border-amber-500 text-amber-700";
  return "border-emerald-500 text-emerald-700";
}

function StockBadge({ stock }: { stock: number }) {
  return (
    <Badge variant="outline" size="sm" className={stockBadgeClass(stock)}>
      Stok {stock}
    </Badge>
  );
}

function groupSummaryText(group: InventoryGroup): string {
  const baruStok = group.baru.reduce((sum, item) => sum + (item.stock_qty ?? 0), 0);
  return `Total stok ${group.totalStok} · Baru ${group.baru.length} varian (${baruStok} unit) · Bekas ${group.bekas.length} unit (${group.bekasTersedia} tersedia)`;
}

function BekasRow({ variant }: { variant: InventoryProduct }) {
  const stock = variant.stock_qty ?? 0;
  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${stock === 0 ? "bg-muted/20 opacity-50" : "border-amber-500/20 bg-amber-500/5"}`}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700">
        <SmartphoneIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs font-medium">
          {variantLabel(variant)}
          {variant.bh_percent != null ? ` · BH ${variant.bh_percent}%` : ""}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {variant.kondisi_notes || "Tanpa catatan kondisi"}
          {variant.garansi_days ? ` · Garansi ${variant.garansi_days} hr` : " · Tanpa garansi"}
        </div>
        <div className="truncate font-mono text-xs">
          {variant.sku}
          {variant.cost != null ? ` · ${formatCurrencyPlain(variant.cost)}` : ""}
          {variant.price != null ? ` → ${formatCurrencyPlain(variant.price)}` : ""}
        </div>
      </div>
      <Badge variant="outline" size="sm" className={stock > 0 ? "border-emerald-500 text-emerald-700" : "border-zinc-400 text-zinc-500"}>
        {stock > 0 ? "Tersedia" : "Terjual"}
      </Badge>
    </div>
  );
}

function CardView({ groups }: { groups: InventoryGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">{group.name}</CardTitle>
                <CardDescription>{groupSummaryText(group)}</CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {group.items.length} varian
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.baru.length > 0 ? (
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Baru — Varian warna &amp; storage (stok agregat)
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.baru.map((variant) => (
                    <div key={variant.id} className="flex gap-3 rounded-lg border bg-card p-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                        <PackageIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{variantLabel(variant)}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">{variant.sku}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <StockBadge stock={variant.stock_qty ?? 0} />
                          {variant.price != null ? (
                            <span className="font-mono text-xs">{formatCurrencyPlain(variant.price)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {group.bekas.length > 0 ? (
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Bekas — Per IMEI (stok 1 per unit)
                </div>
                <div className="space-y-2">
                  {group.bekas.map((variant) => (
                    <BekasRow key={variant.id} variant={variant} />
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableView({ groups }: { groups: InventoryGroup[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => toInventoryTableRows(groups, expanded), [groups, expanded]);

  const toggle = (key: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Produk</TableHead>
            <TableHead className="font-mono text-xs">SKU</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead className="text-right">Modal</TableHead>
            <TableHead className="text-right">Jual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === "parent") {
              const { group } = row;
              const isOpen = expanded.has(group.key) || group.items.length === 1;
              return (
                <TableRow key={`parent-${group.key}`} className="bg-muted/30 hover:bg-muted/40">
                  <TableCell>
                    {group.items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        aria-label={isOpen ? `Ciutkan ${group.name}` : `Buka varian ${group.name}`}
                        aria-expanded={isOpen}
                        className="flex size-6 items-center justify-center rounded hover:bg-foreground/10"
                      >
                        <ChevronRightIcon className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-xs text-muted-foreground">{groupSummaryText(group)}</div>
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{group.items.length} varian</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{group.totalStok}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              );
            }

            const { product } = row;
            const stock = product.stock_qty ?? 0;
            return (
              <TableRow key={`child-${product.id}`} className={stock === 0 ? "text-muted-foreground" : undefined}>
                <TableCell />
                <TableCell className="pl-10">
                  <div className="flex items-center gap-2">
                    {product.variant_type === "BEKAS" ? (
                      <SmartphoneIcon className="size-3.5 shrink-0 text-amber-600" />
                    ) : (
                      <PackageIcon className="size-3.5 shrink-0 text-emerald-600" />
                    )}
                    <span className="truncate text-sm">{variantLabel(product)}</span>
                  </div>
                  {product.variant_type === "BEKAS" && product.kondisi_notes ? (
                    <div className="truncate pl-5 text-xs text-muted-foreground">{product.kondisi_notes}</div>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                <TableCell>
                  <Badge variant={product.variant_type === "BEKAS" ? "outline" : "secondary"} size="sm">
                    {product.variant_type === "BEKAS" ? "Bekas" : "Baru"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={stockBadgeClass(stock)}>{stock}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {product.cost != null ? formatCurrencyPlain(product.cost) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {product.price != null ? formatCurrencyPlain(product.price) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function InventoriClient({
  groups,
  summary,
  truncated,
}: {
  groups: InventoryGroup[];
  summary: InventorySummary;
  truncated: boolean;
}) {
  const [view, setView] = useState<View>("kartu");

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <SmartphoneIcon className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-3 font-medium">Belum ada produk</p>
        <p className="text-sm text-muted-foreground">
          Tambah varian Baru (warna+storage) atau Bekas (IMEI) untuk mulai.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary.groups} produk induk · {summary.varian} varian · {summary.totalStok} unit (Baru{" "}
          {summary.baru} · Bekas {summary.bekas})
          {summary.stokHabis > 0 ? ` · ${summary.stokHabis} varian stok habis` : ""}
        </p>
        <ToggleGroup
          value={[view]}
          onValueChange={(value) => {
            const next = (value as string[])[0];
            if (next === "kartu" || next === "tabel") setView(next);
          }}
          variant="outline"
          size="sm"
          aria-label="Tampilan inventori"
        >
          <ToggleGroupItem value="kartu" aria-label="Tampilan kartu">
            <LayoutGridIcon className="size-3.5" />
            Kartu
          </ToggleGroupItem>
          <ToggleGroupItem value="tabel" aria-label="Tampilan tabel">
            <Rows3Icon className="size-3.5" />
            Tabel
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {truncated ? (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          Daftar produk melebihi batas tampilan, sebagian data tidak terlihat. Gunakan pencarian atau percabangan lain.
        </p>
      ) : null}

      {view === "kartu" ? <CardView groups={groups} /> : <TableView groups={groups} />}
    </div>
  );
}
