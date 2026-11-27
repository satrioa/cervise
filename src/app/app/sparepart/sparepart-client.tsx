"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PackageCheckIcon, PackageIcon, PencilIcon, PlusIcon, SearchIcon, ShoppingCartIcon, TagIcon, TrashIcon, TriangleAlertIcon, TruckIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Button as CossButton } from "@/components/ui/coss-button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshDataButton } from "@/components/layout/refresh-data-button";
import { useBranch } from "@/lib/branch-context";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { playPageTransition } from "@/components/layout/page-transition";
import { DEFAULT_LOW_STOCK_THRESHOLD, lowStockRows, summarizeSparepartStock } from "@/lib/operational/sparepart-stock";
import { CentralStockDialogs } from "@/components/sparepart/central-stock-dialogs";
import { createCentralItem, listCentralItems, purchaseCentralStock, type CentralItemRow } from "./central-actions";
import {
  deleteSparepart,
  listSparepartCategories,
  listSpareparts,
  setSparepartActive,
  updateSparepart,
  type SparepartRow,
} from "./actions";

type Scope = "central" | "branch";
type DialogMode = "distribute" | "request" | "approve";

const EMPTY = {
  kind: "SPAREPART" as "SPAREPART" | "PRODUCT",
  sku: "",
  name: "",
  category: "Sparepart",
  stock_qty: "0",
  cost: "0",
  price: "0",
  imei: "",
};

export default function SparepartPage({ isMasterAdmin, canRequest }: { canManage: boolean; isMasterAdmin: boolean; canRequest: boolean }) {
  const { branch, branches } = useBranch();
  const [scope, setScope] = useState<Scope>(() => (isMasterAdmin ? "central" : "branch"));
  const [rows, setRows] = useState<SparepartRow[]>([]);
  const [centralItems, setCentralItems] = useState<CentralItemRow[]>([]);
  const [categories, setCategories] = useState<string[]>(["Sparepart"]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SparepartRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseId, setPurchaseId] = useState("");
  const [purchaseQty, setPurchaseQty] = useState("1");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async (term = q) => {
    setLoading(true);
    try {
      const [branchRows, centralRows] = await Promise.all([listSpareparts(term), listCentralItems(term)]);
      setRows(branchRows);
      setCentralItems(centralRows);
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
  }, [q, branch.id, scope]);


  const displayRows: SparepartRow[] = scope === "central"
    ? centralItems.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        stock_qty: item.stock_qty,
        low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
        cost: item.cost,
        price: item.price,
        is_active: true,
      }))
    : rows;

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = displayRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const stockSummary = summarizeSparepartStock(displayRows);
  const alerts = scope === "branch" ? lowStockRows(rows) : [];

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, category: categories[0] ?? "Sparepart" });
    setFormOpen(true);
  };

  const openEdit = (row: SparepartRow) => {
    setEditing(row);
    setForm({ ...EMPTY, name: row.name, category: row.category, cost: String(row.cost), price: String(row.price) });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        // updateSparepart mengabaikan sku/stok/ambang, jadi field itu tidak ditampilkan saat edit.
        await updateSparepart(editing.id, {
          name: form.name,
          category: form.category,
          stock_qty: 0,
          cost: Number(form.cost),
          price: Number(form.price),
        });
      } else {
        await createCentralItem({
          kind: form.kind,
          sku: form.sku,
          name: form.name,
          category: form.category,
          stock_qty: Number(form.stock_qty),
          cost: Number(form.cost),
          price: Number(form.price),
          imei: form.kind === "PRODUCT" ? form.imei : undefined,
        });
      }
      playPageTransition();
      toast.success(editing ? "Item diperbarui" : "Item ditambah");
      setFormOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const openPurchase = () => {
    setPurchaseId(centralItems[0]?.id ?? "");
    setPurchaseQty("1");
    setPurchaseCost("");
    setPurchaseOpen(true);
  };

  const handlePurchase = async () => {
    const item = centralItems.find((central) => central.id === purchaseId);
    if (!item) {
      toast.error("Pilih item dulu");
      return;
    }
    const amount = Number(purchaseQty);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Jumlah harus bilangan bulat lebih dari nol");
      return;
    }
    setSaving(true);
    try {
      await purchaseCentralStock({
        id: item.id,
        qty: amount,
        unitCost: purchaseCost === "" ? item.cost : Number(purchaseCost),
        expectedStock: item.stock_qty,
      });
      playPageTransition();
      toast.success("Stok pusat dibeli");
      setPurchaseOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membeli stok");
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
    if (!confirm(`Hapus item "${row.name}"? Riwayat servis yang memakainya tetap tersimpan.`)) return;
    try {
      await deleteSparepart(row.id);
      playPageTransition();
      toast.success("Item dihapus");
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
        description="Stok gudang pusat dan stok cabang. Stok berkurang saat dipakai di servis atau didistribusikan."
        containerClassName="max-w-4xl"
        search={
          <InputGroup className="w-full max-w-sm">
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Cari nama / SKU item..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              nativeInput
              aria-label="Cari sparepart"
            />
          </InputGroup>
        }
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ToggleGroup
              value={[scope]}
              onValueChange={(value) => {
                const next = (value as string[])[0];
                if (next === "central" || next === "branch") setScope(next);
              }}
              variant="outline"
              aria-label="Scope stok"
            >
              <ToggleGroupItem value="central">Pusat</ToggleGroupItem>
              <ToggleGroupItem value="branch">Cabang</ToggleGroupItem>
            </ToggleGroup>
            <RefreshDataButton onRefresh={() => reload(q)} />
            <Button variant="outline" size="sm" className="h-8" render={<Link href="/app/sparepart/opname" />}>
              <PackageCheckIcon className="size-3.5" /> Stock Opname
            </Button>
            {isMasterAdmin && scope === "central" && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={openPurchase} disabled={centralItems.length === 0}>
                  <ShoppingCartIcon className="size-3.5" /> Beli Stok
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setDialogMode("distribute")} disabled={centralItems.length === 0}>
                  <TruckIcon className="size-3.5" /> Distribusi
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setDialogMode("approve")}>
                  Approve Request
                </Button>
                <Button size="sm" className="h-8" onClick={openCreate}>
                  <PlusIcon className="size-3.5" /> Tambah Item
                </Button>
              </>
            )}
            {scope === "branch" && canRequest && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setDialogMode("request")} disabled={centralItems.length === 0}>
                <ShoppingCartIcon className="size-3.5" /> Request Stok
              </Button>
            )}
            {isMasterAdmin && scope === "branch" && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setDialogMode("distribute")} disabled={centralItems.length === 0}>
                <TruckIcon className="size-3.5" /> Distribusi
              </Button>
            )}
            <CossButton variant="outline" size="sm" className="h-8" render={<Link href="/app/kategori-sparepart" />}>
              <TagIcon className="size-3.5" /> Kategori
            </CossButton>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total jenis", value: formatNumberPlain(stockSummary.totalJenis) },
            { label: "Total unit stok", value: formatNumberPlain(stockSummary.totalUnit) },
            { label: "Stok habis", value: formatNumberPlain(stockSummary.habis) },
            { label: "Stok menipis", value: formatNumberPlain(stockSummary.menipis) },
          ].map((card) => (
            <div key={card.label} className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{card.label}</div>
              <div title={card.value} className="mt-2 truncate font-heading text-[clamp(1rem,5vw,1.5rem)] leading-tight tabular-nums">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="min-w-0 lg:col-span-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PackageIcon className="size-4" /> Daftar {scope === "central" ? "Item Pusat" : "Sparepart Cabang"}
                  </CardTitle>
                  <CardDescription>
                    {displayRows.length} item · {scope === "central" ? "Gudang pusat" : branch.label}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>SKU</TableHead>
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
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            Memuat item...
                          </TableCell>
                        </TableRow>
                      ) : displayRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            Belum ada item di scope ini.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pageItems.map((row) => (
                          <TableRow key={row.id} className={row.is_active ? "" : "opacity-50"}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{row.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{row.stock_qty}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrencyPlain(row.cost)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrencyPlain(row.price)}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {isMasterAdmin && (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleToggle(row)}>
                                      {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}>
                                      <PencilIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Hapus ${row.name}`}
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
                {displayRows.length > 0 ? (
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
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
                      <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, displayRows.length)} dari {displayRows.length}</span>
                    </div>
                    <Pagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {alerts.length > 0 ? (
            <div className="min-w-0 lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <TriangleAlertIcon className="size-4" /> Stok perlu perhatian
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {alerts.length} sparepart di bawah ambangnya
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs"
                    >
                      <span className="min-w-0 truncate font-medium" title={row.name}>{row.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground" title={`Ambang ${row.low_stock_threshold}`}>
                        {row.stock_qty}/{row.low_stock_threshold}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      <DialogPrimitive.Root open={formOpen} onOpenChange={setFormOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">
              {editing ? "Edit Item" : "Tambah Item"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {editing
                ? "Nama, kategori, modal, dan harga diperbarui di item pusat."
                : "Item baru masuk ke gudang pusat; stok awal tercatat di ledger."}
            </DialogPrimitive.Description>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nama *</Label>
                <Input aria-label="Nama item" className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Baterai iPhone 12" />
              </div>
              {editing ? null : (
                <>
                  <div className="space-y-1.5">
                    <Label>Jenis</Label>
                    <select
                      value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value as "SPAREPART" | "PRODUCT" })}
                      aria-label="Jenis item"
                      className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="SPAREPART">Sparepart</option>
                      <option value="PRODUCT">Produk</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>SKU *</Label>
                    <Input aria-label="SKU" className="min-h-11 font-mono" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-123" />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  aria-label="Kategori item"
                  className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {editing ? null : (
                <div className="space-y-1.5">
                  <Label>Stok awal</Label>
                  <Input type="number" min={0} inputMode="numeric" aria-label="Stok awal" className="min-h-11" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
                </div>
              )}
              {!editing && form.kind === "PRODUCT" ? (
                <div className="space-y-1.5">
                  <Label>IMEI (opsional)</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={15}
                    aria-label="IMEI"
                    className="min-h-11 font-mono"
                    value={form.imei}
                    onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, "").slice(0, 15) })}
                    placeholder="15 digit"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Modal</Label>
                <Input type="number" min={0} inputMode="numeric" aria-label="Modal" className="min-h-11" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Harga jual</Label>
                <Input type="number" min={0} inputMode="numeric" aria-label="Harga jual" className="min-h-11" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setFormOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button className="min-h-11" onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
              </Button>
            </div>

            <DialogPrimitive.Close className="absolute right-3 top-3 min-h-11 min-w-11 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Beli Stok Pusat</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Stok pusat bertambah dan modal diperbarui. Tercatat di ledger stok.
            </DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Item *</Label>
                <select
                  value={purchaseId}
                  onChange={(e) => setPurchaseId(e.target.value)}
                  aria-label="Pilih item untuk dibeli"
                  className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Pilih item...</option>
                  {centralItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name} (stok {item.stock_qty})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Jumlah beli *</Label>
                <Input type="number" min={1} inputMode="numeric" aria-label="Jumlah beli" className="min-h-11" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Harga beli per unit (Rp)</Label>
                <Input type="number" min={0} inputMode="numeric" aria-label="Harga beli per unit" className="min-h-11" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} placeholder="Modal saat ini" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setPurchaseOpen(false)} disabled={saving}>Batal</Button>
              <Button className="min-h-11" onClick={handlePurchase} disabled={saving}>{saving ? "Memproses..." : "Beli"}</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 min-h-11 min-w-11 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CentralStockDialogs
        key={dialogMode ?? "closed"}
        mode={dialogMode}
        items={centralItems}
        branches={branches}
        currentBranchId={branch.id}
        onClose={() => setDialogMode(null)}
        onDone={() => {
          setDialogMode(null);
          void reload();
        }}
      />
    </div>
  );
}
