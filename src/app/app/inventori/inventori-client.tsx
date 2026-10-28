"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoriToolbar } from "@/components/inventori/inventori-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyPlain } from "@/lib/format";
import { printSkuLabels } from "@/lib/printer/label";
import { ChevronRightIcon, PackageIcon, PrinterIcon, SearchIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  filterInventoryGroups,
  INVENTORI_DEFAULTS,
  summarizeInventory,
  STOCK_MENIPIS_MAX,
  toInventoryTableRows,
  variantLabel,
  type InventoryGroup,
  type InventoryProduct,
  type InventorySummary,
} from "@/lib/operational/inventori";

type View = "kartu" | "tabel";

/**
 * Warna badge stok memakai ambang yang sama dengan filter "Stok menipis" /
 * "Stok tersedia", jadi warna di tabel dan pilihan di toolbar tidak pernah
 * berbeda artinya.
 */
function stockBadgeClass(stock: number): string {
  if (stock <= 0) return "border-destructive text-destructive";
  if (stock < STOCK_MENIPIS_MAX) return "border-amber-500 text-amber-700";
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
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => toInventoryTableRows(groups, expanded), [groups, expanded]);
  const visibleProducts = useMemo(
    () => rows.flatMap((row) => (row.kind === "child" ? [row.product] : [])),
    [rows],
  );
  // Pilihan dihitung dari seluruh varian yang lolos filter, bukan hanya baris
  // yang sedang terbuka, supaya menutup satu group tidak membuang pilihannya.
  const allProducts = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const selectedProducts = useMemo(
    () => allProducts.filter((product) => selected.has(product.id)),
    [allProducts, selected],
  );

  const toggle = (key: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const product of visibleProducts) {
        if (checked) next.add(product.id);
        else next.delete(product.id);
      }
      return next;
    });
  };

  const allSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selected.has(product.id));
  const someSelected = visibleProducts.some((product) => selected.has(product.id));

  const printLabels = (products: InventoryProduct[]) => {
    const opened = printSkuLabels(
      products.map((product) => ({
        name: product.name,
        variant: variantLabel(product),
        sku: product.sku,
        price: product.price,
      })),
    );
    if (!opened) toast.error("Pop-up diblokir — izinkan pop-up untuk mencetak label");
  };

  return (
    <div className="space-y-2">
      {selectedProducts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
          <span className="text-sm">{selectedProducts.length} produk dipilih</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Batal pilih
            </Button>
            <Button size="sm" onClick={() => printLabels(selectedProducts)}>
              <PrinterIcon className="size-4" /> Cetak Label ({selectedProducts.length})
            </Button>
          </div>
        </div>
      ) : null}
    <div className="rounded-xl border bg-white dark:bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                aria-label="Pilih semua varian yang terlihat"
              />
            </TableHead>
            <TableHead className="w-8" />
            <TableHead>Produk</TableHead>
            <TableHead className="font-mono text-xs">SKU</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead className="text-right">Modal</TableHead>
            <TableHead className="text-right">Jual</TableHead>
            <TableHead className="text-right">Cetak SKU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === "parent") {
              const { group } = row;
              const isOpen = expanded.has(group.key) || group.items.length === 1;
              return (
                <TableRow key={`parent-${group.key}`} className="bg-muted/30 hover:bg-muted/40">
                  <TableCell />
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
                  <TableCell />
                </TableRow>
              );
            }

            const { product } = row;
            const stock = product.stock_qty ?? 0;
            return (
              <TableRow key={`child-${product.id}`} className={stock === 0 ? "text-muted-foreground" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(product.id)}
                    onCheckedChange={(checked) => toggleOne(product.id, checked === true)}
                    aria-label={`Pilih ${product.name} ${product.sku}`}
                  />
                </TableCell>
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
                <TableCell className="text-right">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Cetak SKU ${product.sku}`}
                    title="Cetak SKU"
                    onClick={() => printLabels([product])}
                  >
                    <PrinterIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}

export function InventoriClient({
  groups,
  summary,
  truncated,
  q,
  tipe,
  stok,
}: {
  groups: InventoryGroup[];
  summary: InventorySummary;
  truncated: boolean;
  /** Nilai awal dari URL, dipakai server component. */
  q: string;
  tipe: string;
  stok: string;
}) {
  const [view, setView] = useState<View>("kartu");
  const router = useRouter();
  const pathname = usePathname();

  // Disaring di client: `getInventori` sudah mengambil seluruh katalog sekali
  // jalan, jadi menyaring ulang hanya menambah latency tanpa menambah data.
  const filteredGroups = useMemo(() => filterInventoryGroups(groups, { q, tipe, stok }), [groups, q, tipe, stok]);
  // Ringkasan dihitung ulang dari hasil filter supaya angka pada baris
  // ringkasan dan isi tabel tidak pernah berbeda.
  const filteredSummary = useMemo(() => summarizeInventory(filteredGroups), [filteredGroups]);
  const isFiltered = q.trim() !== "" || tipe !== INVENTORI_DEFAULTS.tipe || stok !== INVENTORI_DEFAULTS.stok;

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
      <InventoriToolbar
        q={q}
        tipe={tipe}
        stok={stok}
        view={view}
        onViewChange={setView}
        shown={filteredSummary.varian}
        total={summary.varian}
        summary={filteredSummary}
      />

      {truncated ? (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          Daftar produk melebihi batas tampilan, sebagian data tidak terlihat. Gunakan pencarian atau percabangan lain.
        </p>
      ) : null}

      {isFiltered && filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <SearchIcon className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-3 font-medium">Tidak ada produk yang cocok</p>
          <p className="text-sm text-muted-foreground">
            Ubah kata kunci atau atur ulang filter untuk melihat {summary.varian} varian.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.replace(pathname)}>
            <XIcon /> Atur ulang filter
          </Button>
        </div>
      ) : view === "kartu" ? (
        <CardView groups={filteredGroups} />
      ) : (
        <TableView groups={filteredGroups} />
      )}
    </div>
  );
}
