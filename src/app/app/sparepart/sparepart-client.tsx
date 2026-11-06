"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PackageIcon, PencilIcon, PlusIcon, SearchIcon, ShoppingCartIcon, TagIcon, TrashIcon, TruckIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { useBranch, type Branch } from "@/lib/branch-context";
import { formatCurrencyPlain } from "@/lib/format";
import { playPageTransition } from "@/components/layout/page-transition";
import {
  createSparepart,
  deleteSparepart,
  listSparepartCategories,
  listSpareparts,
  purchaseSparepartStock,
  setSparepartActive,
  transferSparepartStock,
  updateSparepart,
  type SparepartRow,
} from "./actions";

const EMPTY = { sku: "", name: "", category: "Sparepart", stock_qty: "0", cost: "0", price: "0" };

export default function SparepartPage({ canManage }: { canManage: boolean }) {
  const { branch, branches } = useBranch();
  const [rows, setRows] = useState<SparepartRow[]>([]);
  const [categories, setCategories] = useState<string[]>(["Sparepart"]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SparepartRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [stockMode, setStockMode] = useState<"beli" | "transfer" | null>(null);

  const reload = async (term = q) => {
    setLoading(true);
    try {
      setRows(await listSpareparts(term));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat sparepart");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listSparepartCategories()
      .then(setCategories)
      .catch(() => setCategories(["Sparepart"]));
  }, [branch.id]);

  useEffect(() => {
    const t = setTimeout(() => reload(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, branch.id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, category: categories[0] ?? "Sparepart" });
    setOpen(true);
  };

  const openEdit = (row: SparepartRow) => {
    setEditing(row);
    setForm({
      sku: row.sku,
      name: row.name,
      category: row.category,
      stock_qty: String(row.stock_qty),
      cost: String(row.cost),
      price: String(row.price),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category,
        stock_qty: Number(form.stock_qty),
        cost: Number(form.cost),
        price: Number(form.price),
      };
      if (editing) await updateSparepart(editing.id, payload);
      else await createSparepart(payload);
      playPageTransition();
      toast.success(editing ? "Sparepart diperbarui" : "Sparepart ditambah");
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: SparepartRow) => {
    try {
      await setSparepartActive(row.id, !row.is_active);
      playPageTransition();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  };

  const handleDelete = async (row: SparepartRow) => {
    if (!confirm(`Hapus sparepart "${row.name}"? Riwayat servis yang memakainya tetap tersimpan.`)) return;
    try {
      await deleteSparepart(row.id);
      playPageTransition();
      toast.success("Sparepart dihapus");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  return (
    <div className="min-h-svh bg-transparent">
      <PageHeader
        title="Sparepart"
        titleClassName="font-heading text-2xl"
        description="Stok sparepart terpisah dari inventori produk. Stok berkurang saat dipakai di servis."
        containerClassName="max-w-4xl"
        search={
          <InputGroup className="w-full max-w-sm">
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Cari nama / SKU sparepart..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              nativeInput
              aria-label="Cari sparepart"
            />
          </InputGroup>
        }
        actions={
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setStockMode("beli")} disabled={!canManage || rows.length === 0}>
              <ShoppingCartIcon className="size-3.5" /> Beli Sparepart
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setStockMode("transfer")}
              disabled={!canManage || rows.length === 0 || branches.filter((b) => b.id !== "all" && b.id !== branch.id).length === 0}
            >
              <TruckIcon className="size-3.5" /> Transfer Stok
            </Button>
            <Button variant="outline" size="sm" className="h-8" render={<Link href="/app/kategori-sparepart" />}>
              <TagIcon className="size-3.5" /> Kategori
            </Button>
            <Button size="sm" className="h-8" onClick={openCreate} disabled={!canManage}>
              <PlusIcon className="size-3.5" /> Tambah Sparepart
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageIcon className="size-4" /> Daftar Sparepart
              </CardTitle>
              <CardDescription>
                {rows.length} sparepart · {branch.label}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Modal</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Memuat sparepart...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Belum ada sparepart. Klik Tambah Sparepart.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id} className={row.is_active ? "" : "opacity-50"}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.stock_qty}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrencyPlain(row.cost)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrencyPlain(row.price)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {canManage && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleToggle(row)}>
                                  {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                                  <PencilIcon className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(row)}
                                >
                                  <TrashIcon className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">
              {editing ? "Edit Sparepart" : "Tambah Sparepart"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Stok awal bisa diisi; perubahan stok berikutnya tercatat di ledger.
            </DialogPrimitive.Description>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nama *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Baterai iPhone 12" />
              </div>
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Otomatis" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Stok</Label>
                <Input type="number" min={0} value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Modal</Label>
                <Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Harga jual</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
              </Button>
            </div>

            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <StockActionDialog
        key={stockMode ?? "closed"}
        mode={stockMode}
        rows={rows}
        branches={branches}
        currentBranchId={branch.id}
        onClose={() => setStockMode(null)}
        onDone={() => {
          setStockMode(null);
          void reload();
        }}
      />
    </div>
  );
}

/** Beli stok baru atau transfer antar cabang; keduanya lewat RPC ber-ledger. */
function StockActionDialog({
  mode,
  rows,
  branches,
  currentBranchId,
  onClose,
  onDone,
}: {
  mode: "beli" | "transfer" | null;
  rows: SparepartRow[];
  branches: Branch[];
  currentBranchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const isPurchase = mode === "beli";
  const selected = rows.find((row) => row.id === id) ?? null;
  const targets = branches.filter((b) => b.id !== "all" && b.id !== currentBranchId);

  const handleSubmit = async () => {
    if (!selected) {
      toast.error("Pilih sparepart dulu");
      return;
    }
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Jumlah harus bilangan bulat lebih dari nol");
      return;
    }
    if (!isPurchase && !target) {
      toast.error("Pilih cabang tujuan");
      return;
    }

    setSaving(true);
    try {
      if (isPurchase) {
        await purchaseSparepartStock({
          id: selected.id,
          qty: amount,
          unitCost: unitCost === "" ? selected.cost : Number(unitCost),
        });
        toast.success("Stok sparepart dibeli");
      } else {
        await transferSparepartStock({ id: selected.id, targetBranchId: target, qty: amount });
        toast.success("Stok ditransfer");
      }
      playPageTransition();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses stok");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
          <DialogPrimitive.Title className="font-semibold">
            {isPurchase ? "Beli Sparepart" : "Transfer Stok (Antar Cabang)"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            {isPurchase
              ? "Stok bertambah dan harga modal diperbarui. Tercatat di ledger stok."
              : "Stok berkurang dari cabang ini dan bertambah di cabang tujuan."}
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Sparepart *</Label>
              <select
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Pilih sparepart...</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} — {row.sku} (stok {row.stock_qty})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{isPurchase ? "Jumlah beli *" : "Jumlah transfer *"}</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              {selected ? (
                <p className="text-[11px] text-muted-foreground">Stok saat ini {selected.stock_qty} unit.</p>
              ) : null}
            </div>

            {isPurchase ? (
              <div className="space-y-1.5">
                <Label>Harga beli per unit (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={selected ? String(selected.cost) : "Modal saat ini"}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Cabang tujuan *</Label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Pilih cabang...</option>
                  {targets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Memproses..." : isPurchase ? "Beli" : "Transfer"}
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
