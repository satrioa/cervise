"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { InventoriToolbar } from "@/components/inventori/inventori-toolbar";
import { EditProductDialog } from "@/components/inventori/edit-product-dialog";
import { ProductPhotoButton } from "@/components/inventori/product-photo";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyPlain } from "@/lib/format";
import { renderSkuLabelHtml, type SkuLabelInput } from "@/lib/printer/label";
import { printSkuLabelsDirect } from "@/lib/printer";
import { ChevronRightIcon, PencilIcon, PrinterIcon, SearchIcon, SmartphoneIcon, XIcon } from "lucide-react";
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

function HoverActions({ product, onEdit, onPrint }: { product: InventoryProduct; onEdit: (p: InventoryProduct) => void; onPrint: (p: InventoryProduct) => void }) {
  return (
    <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${product.sku}`} title="Edit" onClick={() => onEdit(product)}>
        <PencilIcon className="size-3.5" />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Cetak SKU ${product.sku}`} title="Cetak SKU" onClick={() => onPrint(product)}>
        <PrinterIcon className="size-3.5" />
      </Button>
    </div>
  );
}

function BekasRow({ variant, onEdit, onPrint }: { variant: InventoryProduct; onEdit: (p: InventoryProduct) => void; onPrint: (p: InventoryProduct) => void }) {
  const stock = variant.stock_qty ?? 0;
  return (
    <div className={`group flex gap-3 rounded-lg border p-3 ${stock === 0 ? "bg-muted/20 opacity-50" : "border-amber-500/20 bg-amber-500/5"}`}>
      <ProductPhotoButton
        productId={variant.id}
        imageUrl={variant.image_url ?? null}
        name={variantLabel(variant)}
        variantType={variant.variant_type}
        category={variant.category}
        className="size-10"
      />
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
      <HoverActions product={variant} onEdit={onEdit} onPrint={onPrint} />
      <Badge variant="outline" size="sm" className={stock > 0 ? "border-emerald-500 text-emerald-700" : "border-zinc-400 text-zinc-500"}>
        {stock > 0 ? "Tersedia" : "Terjual"}
      </Badge>
    </div>
  );
}

function CardView({ groups, onEdit, onPrint }: { groups: InventoryGroup[]; onEdit: (p: InventoryProduct) => void; onPrint: (p: InventoryProduct) => void }) {
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
                    <div key={variant.id} className="group flex gap-3 rounded-lg border bg-card p-3">
                      <ProductPhotoButton
                        productId={variant.id}
                        imageUrl={variant.image_url ?? null}
                        name={variantLabel(variant)}
                        variantType={variant.variant_type}
                        category={variant.category}
                        className="size-10"
                      />
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
                      <HoverActions product={variant} onEdit={onEdit} onPrint={onPrint} />
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
                    <BekasRow key={variant.id} variant={variant} onEdit={onEdit} onPrint={onPrint} />
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

function TableView({ groups, onEdit, onPrint }: { groups: InventoryGroup[]; onEdit: (p: InventoryProduct) => void; onPrint: (products: InventoryProduct[]) => void }) {
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

  return (
    <div className="space-y-2">
      {selectedProducts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
          <span className="text-sm">{selectedProducts.length} produk dipilih</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Batal pilih
            </Button>
            <Button size="sm" onClick={() => onPrint(selectedProducts)}>
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
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === "parent") {
              const { group } = row;
              const isOpen = expanded.has(group.key) || group.items.length === 1;
              return (
                <TableRow
                  key={`parent-${group.key}`}
                  className="group cursor-pointer bg-muted/30 hover:bg-muted/40"
                  onClick={() => group.items.length > 1 && toggle(group.key)}
                >
                  <TableCell />
                  <TableCell>
                    {group.items.length > 1 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(group.key);
                        }}
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
              <TableRow key={`child-${product.id}`} className={`group ${stock === 0 ? "text-muted-foreground" : ""}`}>
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
                    <ProductPhotoButton
                      productId={product.id}
                      imageUrl={product.image_url ?? null}
                      name={variantLabel(product)}
                      variantType={product.variant_type}
                      category={product.category}
                      className="size-7"
                    />
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
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${product.sku}`} title="Edit" onClick={() => onEdit(product)}>
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Cetak SKU ${product.sku}`} title="Cetak SKU" onClick={() => onPrint([product])}>
                      <PrinterIcon className="size-4" />
                    </Button>
                  </div>
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
  edit,
}: {
  groups: InventoryGroup[];
  summary: InventorySummary;
  truncated: boolean;
  /** Nilai awal dari URL, dipakai server component. */
  q: string;
  tipe: string;
  stok: string;
  /** Id varian dari command palette; dialog edit dibuka sekali lalu URL dibersihkan. */
  edit?: string;
}) {
  const [view, setView] = useState<View>("kartu");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editTarget, setEditTarget] = useState<InventoryProduct | null>(null);
  const [labelPreview, setLabelPreview] = useState<SkuLabelInput[] | null>(null);
  const [printingLabels, setPrintingLabels] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!edit) return;
    const target = groups.flatMap((group) => group.items).find((item) => item.id === edit);
    if (!target) return;
    setEditTarget(target);
    router.replace(pathname, { scroll: false });
  }, [edit, groups, pathname, router]);

  /** Pratinjau dulu; cetak langsung ke printer terhubung setelah "Cetak Label". */
  const openLabelPreview = (products: InventoryProduct[]) => {
    if (products.length === 0) return;
    setLabelPreview(
      products.map((product) => ({
        name: product.name,
        variant: variantLabel(product),
        sku: product.sku,
        price: product.price,
      })),
    );
  };

  // Disaring di client: `getInventori` sudah mengambil seluruh katalog sekali
  // jalan, jadi menyaring ulang hanya menambah latency tanpa menambah data.
  const filteredGroups = useMemo(() => filterInventoryGroups(groups, { q, tipe, stok }), [groups, q, tipe, stok]);
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedGroups = filteredGroups.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [q, tipe, stok]);
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
        <CardView groups={paginatedGroups} onEdit={setEditTarget} onPrint={(p) => openLabelPreview([p])} />
      ) : (
        <TableView groups={paginatedGroups} onEdit={setEditTarget} onPrint={openLabelPreview} />
      )}

      {filteredGroups.length > 0 ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Per halaman</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectPopup>
            </Select>
            <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredGroups.length)} dari {filteredGroups.length}</span>
          </div>
          <Pagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <EditProductDialog
        product={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSuccess={() => router.refresh()}
      />

      <DialogPrimitive.Root open={labelPreview !== null} onOpenChange={(open) => !open && !printingLabels && setLabelPreview(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
            <div className="border-b px-5 py-3">
              <DialogPrimitive.Title className="font-heading text-base font-semibold">Pratinjau Label SKU</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground">
                {labelPreview?.length ?? 0} label · 50 × 25 mm · dicetak langsung ke printer terhubung
              </DialogPrimitive.Description>
            </div>
            <div className="flex-1 overflow-auto bg-muted/30 p-4">
              <iframe
                title="Pratinjau label SKU"
                className="mx-auto h-[420px] w-full max-w-[420px] rounded-lg border bg-white"
                srcDoc={labelPreview ? renderSkuLabelHtml(labelPreview, false) : ""}
              />
            </div>
            <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-3">
              <Button variant="outline" disabled={printingLabels} onClick={() => setLabelPreview(null)}>Batal</Button>
              <Button
                disabled={printingLabels || !labelPreview?.length}
                onClick={async () => {
                  if (!labelPreview?.length) return;
                  setPrintingLabels(true);
                  try {
                    await printSkuLabelsDirect(labelPreview);
                    toast.success("Label dikirim ke printer");
                    setLabelPreview(null);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Gagal mencetak label");
                  } finally {
                    setPrintingLabels(false);
                  }
                }}
              >
                <PrinterIcon className="size-4" /> {printingLabels ? "Mencetak..." : "Cetak Label"}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
