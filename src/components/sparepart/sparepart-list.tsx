"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventoryContextMenu } from "./inventory-context-menu";
import { InventoryGrid } from "./inventory-grid";
import { stockTone, type SparepartRow } from "./stock-tone";
import { SparepartFormDialog } from "./sparepart-form-dialog";
import { StockAdjustDialog, TransferDialog } from "./stock-dialogs";
import { archiveSparepart, deleteSparepart } from "@/app/app/sparepart/actions";

export function SparepartList({
  rows,
  categories,
  view,
}: {
  rows: SparepartRow[];
  categories: string[];
  view: "tabel" | "grid";
}) {
  const router = useRouter();
  const [editItem, setEditItem] = useState<SparepartRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addStockItem, setAddStockItem] = useState<SparepartRow | null>(null);
  const [transferItem, setTransferItem] = useState<SparepartRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<SparepartRow | null>(null);
  const [archiveItem, setArchiveItem] = useState<SparepartRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => router.refresh();

  const handleArchive = async (item: SparepartRow, active: boolean) => {
    setBusy(true);
    try {
      await archiveSparepart(item.id!, active);
      toast.success(active ? "Sparepart diaktifkan" : "Sparepart diarsipkan");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
      setArchiveItem(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem?.id) return;
    setBusy(true);
    try {
      await deleteSparepart(deleteItem.id);
      toast.success("Sparepart dihapus");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal hapus");
    } finally {
      setBusy(false);
      setDeleteItem(null);
    }
  };

  if (rows.length === 0) {
    if (view === "grid") return <InventoryGrid rows={rows} />;
    return (
      <div className="rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Sparepart</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="w-[280px]">Stok</TableHead>
              <TableHead className="pe-4 text-right">Harga Modal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Belum ada sparepart. Klik Tambah Sparepart.</TableCell></TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <InventoryContextMenu
              key={p.sku}
              item={p}
              onAddStock={(it) => setAddStockItem(it as SparepartRow)}
              onTransfer={(it) => setTransferItem(it as SparepartRow)}
              onEdit={(it) => { setEditItem(it as SparepartRow); setEditOpen(true); }}
              onArchive={(it) => setArchiveItem(it as SparepartRow)}
              onDelete={(it) => setDeleteItem(it as SparepartRow)}
            >
              <div className="rounded-xl border bg-card p-4 shadow-xs/5 cursor-context-menu hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-muted-foreground text-xs">{p.variant}</div>
                  </div>
                  <Badge variant="outline" size="sm" className={stockTone(p).cls}>{stockTone(p).label}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{p.sku}</span>
                  <Badge variant="secondary" className="text-[11px]">{p.category}</Badge>
                  {p.is_active === false && <Badge variant="outline" size="sm" className="border-muted-foreground/30">Arsip</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={"h-full " + stockTone(p).barCls} style={{ width: `${Math.min(100, Math.round((p.stock / p.capacity) * 100))}%` }} /></div>
                  <span className="font-mono text-xs tabular-nums">{p.stock}<span className="text-muted-foreground/60">/{p.capacity}</span></span>
                </div>
                <div className="mt-2 text-right font-mono text-sm tabular-nums">Rp {p.price.toLocaleString("id-ID")}</div>
              </div>
            </InventoryContextMenu>
          ))}
        </div>
        <SparepartFormDialog open={editOpen} onOpenChange={setEditOpen} editing={editItem ? { id: editItem.id!, name: editItem.name, category: editItem.category, unit: editItem.unit ?? "pcs", cost_cents: editItem.cost_cents ?? 0, price_cents: editItem.price_cents ?? 0, min_stock: editItem.min_stock ?? 0 } : null} existingCategories={categories} onDone={refresh} />
        <StockAdjustDialog open={!!addStockItem} onOpenChange={(v) => !v && setAddStockItem(null)} item={addStockItem ? { id: addStockItem.id!, name: addStockItem.name, sku: addStockItem.sku } : null} onDone={refresh} />
        <TransferDialog open={!!transferItem} onOpenChange={(v) => !v && setTransferItem(null)} item={transferItem ? { id: transferItem.id!, name: transferItem.name, sku: transferItem.sku } : null} onDone={refresh} />
        <ArchiveConfirm open={!!archiveItem} item={archiveItem} onClose={() => setArchiveItem(null)} onConfirm={() => archiveItem && handleArchive(archiveItem, !archiveItem.is_active)} busy={busy} />
        <DeleteConfirm open={!!deleteItem} item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} busy={busy} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Sparepart</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="w-[280px]">Stok</TableHead>
              <TableHead className="pe-4 text-right">Harga Modal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const tone = stockTone(p);
              const pct = Math.min(100, Math.round((p.stock / p.capacity) * 100));
              return (
                <InventoryContextMenu
                  key={p.sku}
                  item={p}
                  onAddStock={(it) => setAddStockItem(it as SparepartRow)}
                  onTransfer={(it) => setTransferItem(it as SparepartRow)}
                  onEdit={(it) => { setEditItem(it as SparepartRow); setEditOpen(true); }}
                  onArchive={(it) => setArchiveItem(it as SparepartRow)}
                  onDelete={(it) => setDeleteItem(it as SparepartRow)}
                >
                  <TableRow className="cursor-context-menu hover:bg-muted/40">
                    <TableCell className="ps-4">
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2 truncate">{p.name}{p.is_active === false && <Badge variant="outline" size="sm" className="border-muted-foreground/30">Arsip</Badge>}</div>
                        <div className="text-muted-foreground text-xs truncate">{p.variant}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">{p.sku}</TableCell>
                    <TableCell className="text-muted-foreground"><Badge variant="secondary" className="text-[11px]">{p.category}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className={"h-full " + tone.barCls} style={{ width: `${pct}%` }} /></div>
                        <span className="font-mono text-xs tabular-nums">{p.stock}<span className="text-muted-foreground/60">/{p.capacity}</span></span>
                        <Badge variant="outline" size="sm" className={"ml-1 " + tone.cls}>{tone.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="pe-4 text-right font-mono tabular-nums">Rp {p.price.toLocaleString("id-ID")}</TableCell>
                  </TableRow>
                </InventoryContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <SparepartFormDialog open={editOpen} onOpenChange={setEditOpen} editing={editItem ? { id: editItem.id!, name: editItem.name, category: editItem.category, unit: editItem.unit ?? "pcs", cost_cents: editItem.cost_cents ?? 0, price_cents: editItem.price_cents ?? 0, min_stock: editItem.min_stock ?? 0 } : null} existingCategories={categories} onDone={refresh} />
      <StockAdjustDialog open={!!addStockItem} onOpenChange={(v) => !v && setAddStockItem(null)} item={addStockItem ? { id: addStockItem.id!, name: addStockItem.name, sku: addStockItem.sku } : null} onDone={refresh} />
      <TransferDialog open={!!transferItem} onOpenChange={(v) => !v && setTransferItem(null)} item={transferItem ? { id: transferItem.id!, name: transferItem.name, sku: transferItem.sku } : null} onDone={refresh} />
      <ArchiveConfirm open={!!archiveItem} item={archiveItem} onClose={() => setArchiveItem(null)} onConfirm={() => archiveItem && handleArchive(archiveItem, !archiveItem.is_active)} busy={busy} />
      <DeleteConfirm open={!!deleteItem} item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}

function ArchiveConfirm({ open, item, onClose, onConfirm, busy }: { open: boolean; item: SparepartRow | null; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  const isArchived = item?.is_active === false;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isArchived ? "Aktifkan sparepart?" : "Arsipkan sparepart?"}</DialogTitle>
          <DialogDescription>{item ? `${item.name} · ${item.sku} — ${isArchived ? "akan tampil lagi di daftar" : "disembunyikan dari daftar & pencarian; riwayat stok tetap"}` : ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
          <Button onClick={onConfirm} disabled={busy}>{busy ? "Menyimpan…" : isArchived ? "Aktifkan" : "Arsipkan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({ open, item, onClose, onConfirm, busy }: { open: boolean; item: SparepartRow | null; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus sparepart?</DialogTitle>
          <DialogDescription>{item ? `${item.name} · ${item.sku} — hanya bisa dihapus jika belum pernah dipakai & tanpa riwayat stok. Jika tidak, arsipkan saja.` : ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
