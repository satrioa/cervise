"use client";

import { useEffect, useState } from "react";
import { SearchIcon, MinusIcon, PlusIcon, PackageIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { searchSparepartStock, useSparepartsForServis, addSparepartsToServis, cancelServisWithSpareparts, getServisSpareparts, type SparepartStockRow } from "@/app/app/servis/sparepart-actions";

type Selected = { row: SparepartStockRow; qty: number };

export function SparepartPickDialog({
  open,
  onOpenChange,
  servis,
  mode,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servis: { id: string; device?: string } | null;
  mode: "transition" | "add";
  onSuccess: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SparepartStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQ("");
    setSelected([]);
    // initial load
    setLoading(true);
    searchSparepartStock("")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoading(true);
      searchSparepartStock(q)
        .then(setRows)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const toggle = (row: SparepartStockRow) => {
    setSelected((prev) => {
      const idx = prev.findIndex((s) => s.row.id === row.id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { row, qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) => {
    setSelected((prev) => prev.map((s) => (s.row.id === id ? { ...s, qty: Math.max(1, Math.min(qty, s.row.qty)) } : s)));
  };

  const handleSave = async ( opts?: { skip?: boolean }) => {
    if (!servis?.id) return;
    setSaving(true);
    setError(null);
    try {
      const items = opts?.skip ? [] : selected.map((s) => ({ inventory_item_id: s.row.id, qty: s.qty }));
      // validate qty <= stock client side
      for (const s of selected) {
        if (s.qty > s.row.qty) throw new Error(`Stok ${s.row.name} sisa ${s.row.qty}, diminta ${s.qty}`);
      }
      if (mode === "transition") {
        await useSparepartsForServis(servis.id, items);
      } else {
        if (items.length === 0) throw new Error("Pilih minimal 1 sparepart");
        await addSparepartsToServis(servis.id, items);
      }
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const totalPicked = selected.reduce((a, b) => a + b.qty, 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
          <div className="shrink-0 border-b px-5 py-4">
            <DialogPrimitive.Title className="font-heading text-base font-semibold flex items-center gap-2">
              <PackageIcon className="size-4" />
              {mode === "transition" ? "Sparepart yang digunakan" : "Tambah Sparepart"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {mode === "transition" ? (
                <>Pilih sparepart untuk servis <span className="font-mono font-medium text-foreground">{servis?.id}</span> · {servis?.device ?? ""} — akan langsung mengurangi stok inventory. Boleh dilewati jika tidak pakai part.</>
              ) : (
                <>Tambah pemakaian sparepart saat status Dikerjakan — stok akan langsung terpotong.</>
              )}
            </DialogPrimitive.Description>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 opacity-60" />
              <Input placeholder="Cari nama / SKU sparepart..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9" />
            </div>

            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-1.5"><AlertTriangleIcon className="size-3.5" />{error}</div>}

            {selected.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Terpilih {selected.length} item · total {totalPicked} pcs</div>
                {selected.map((s) => (
                  <div key={s.row.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.row.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{s.row.sku} · stok {s.row.qty}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon-sm" variant="outline" onClick={() => setQty(s.row.id, s.qty - 1)} disabled={s.qty <= 1}><MinusIcon className="size-3" /></Button>
                      <span className="w-7 text-center font-mono text-sm">{s.qty}</span>
                      <Button size="icon-sm" variant="outline" onClick={() => setQty(s.row.id, s.qty + 1)} disabled={s.qty >= s.row.qty}><PlusIcon className="size-3" /></Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => toggle(s.row)}><XIcon className="size-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">{loading ? "Memuat..." : `${rows.length} sparepart`}</div>
              <div className="divide-y rounded-lg border overflow-hidden">
                {rows.length === 0 && !loading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Tidak ada sparepart yang cocok</div>
                ) : (
                  rows.map((r) => {
                    const isSel = selected.some((s) => s.row.id === r.id);
                    const out = r.qty === 0;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={out}
                        onClick={() => toggle(r)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed ${isSel ? "bg-primary/5" : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{r.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{r.sku} · Rp {(r.price_cents / 100).toLocaleString("id-ID")}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={out ? "destructive" : r.qty < 5 ? "warning" : "secondary"}>{out ? "Habis" : `Stok ${r.qty}`}</Badge>
                          <span className={`size-4 rounded border flex items-center justify-center ${isSel ? "bg-primary border-primary text-primary-foreground" : "bg-background"}`}>{isSel ? "✓" : ""}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t bg-muted/20 px-4 py-3 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Tutup</Button>
            <div className="flex gap-2">
              {mode === "transition" && (
                <Button variant="outline" onClick={() => handleSave({ skip: true })} disabled={saving}>
                  {saving ? "Menyimpan..." : "Lewati / Tanpa sparepart"}
                </Button>
              )}
              <Button onClick={() => handleSave()} disabled={saving || (mode === "add" && selected.length === 0)}>
                {saving ? "Menyimpan..." : mode === "transition" ? `Simpan & Kerjakan${selected.length ? ` (${totalPicked})` : ""}` : `Tambah (${totalPicked})`}
              </Button>
            </div>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CancelSparepartDialog({
  open,
  onOpenChange,
  servis,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servis: { id: string; device?: string } | null;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !servis?.id) return;
    setLoading(true);
    setError(null);
    getServisSpareparts(servis.id)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, servis?.id]);

  const handle = async (decision: "return" | "keep_consumed") => {
    if (!servis?.id) return;
    setSaving(true);
    setError(null);
    try {
      await cancelServisWithSpareparts(servis.id, decision);
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message ?? "Gagal membatalkan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-xl">
          <DialogPrimitive.Title className="font-semibold flex items-center gap-2"><AlertTriangleIcon className="size-4 text-amber-600" /> Batalkan Servis?</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            Servis <span className="font-mono font-medium text-foreground">{servis?.id}</span> sudah pakai sparepart. Kembalikan ke stok?
          </DialogPrimitive.Description>

          <div className="mt-4">
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Memuat sparepart...</div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">Tidak ada sparepart tercatat — akan langsung Batal.</div>
            ) : (
              <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                {rows.map((r: any) => (
                  <div key={r.id} className="flex justify-between px-3 py-2 text-sm">
                    <span className="truncate">{r.name ?? r.description}</span>
                    <span className="font-mono">×{r.qty}</span>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Urungkan</Button>
            <Button variant="outline" onClick={() => handle("keep_consumed")} disabled={saving} title="Stok tetap terpotong, tercatat sebagai Terpakai">
              {saving ? "..." : "Tetap terpakai"}
            </Button>
            <Button onClick={() => handle("return")} disabled={saving} title="Stok dikembalikan">
              {saving ? "..." : "Kembalikan ke stok"}
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
