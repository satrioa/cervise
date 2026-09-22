/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createSparepart, updateSparepart } from "@/app/app/sparepart/actions";

type Editing = { id: string; name: string; category: string; unit: string; cost_cents: number; price_cents: number; min_stock: number } | null;

const CATEGORIES = ["LCD", "Baterai", "Flex / Kabel", "Kaca / Lens", "IC / Mesin", "Aksesoris", "Lainnya"] as const;
const UNITS = ["pcs", "set", "meter", "pack"] as const;

function rupiahToCents(s: string): number {
  const n = Number(String(s).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? Math.floor(n * 100) : 0;
}
function centsToRupiah(c: number): string {
  return String(Math.floor(Number(c ?? 0) / 100));
}

export function SparepartFormDialog({
  open,
  onOpenChange,
  editing,
  existingCategories,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Editing;
  existingCategories: string[];
  onDone: () => void;
}) {
  const isEdit = !!editing;
  const catOptions = useMemo(() => {
    const set = new Set<string>([...CATEGORIES, ...existingCategories]);
    return [...set].sort((a, b) => a.localeCompare(b, "id"));
  }, [existingCategories]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Lainnya");
  const [unit, setUnit] = useState<string>("pcs");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [opening, setOpening] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCategory(editing.category || "Lainnya");
      setUnit(editing.unit || "pcs");
      setCost(centsToRupiah(editing.cost_cents));
      setPrice(centsToRupiah(editing.price_cents));
      setMinStock(String(editing.min_stock ?? 0));
      setOpening("");
    } else {
      setName("");
      setCategory("Lainnya");
      setUnit("pcs");
      setCost("");
      setPrice("");
      setMinStock("0");
      setOpening("0");
    }
  }, [open, editing]);

  const submit = async () => {
    const n = name.trim();
    if (!n) { toast.error("Nama wajib diisi"); return; }
    const costCents = rupiahToCents(cost);
    const priceCents = rupiahToCents(price);
    const min = Math.max(0, Math.floor(Number(minStock) || 0));
    const openQty = Math.max(0, Math.floor(Number(opening) || 0));
    setSaving(true);
    try {
      if (isEdit && editing) {
        await updateSparepart({ id: editing.id, name: n, category, unit, costCents, priceCents, minStock: min });
        toast.success("Sparepart diperbarui");
      } else {
        await createSparepart({ name: n, category, unit, costCents, priceCents, minStock: min, openingQty: openQty });
        toast.success("Sparepart ditambahkan");
      }
      onOpenChange(false);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Sparepart" : "Tambah Sparepart"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Ubah data sparepart. SKU tidak dapat diubah." : "SKU otomatis (SP-XXX). Isi harga dalam Rupiah."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nama *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. LCD iPhone 11 Original" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "Lainnya")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPopup>
                  {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectPopup>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Satuan</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v ?? "pcs")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPopup>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectPopup>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Harga Modal (Rp)</Label>
              <Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
            <div className="grid gap-1.5">
              <Label>Harga Jual (Rp)</Label>
              <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Stok Minimal</Label>
              <Input inputMode="numeric" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
              <span className="text-[11px] text-muted-foreground">Untuk badge Menipis & bar.</span>
            </div>
            {!isEdit && (
              <div className="grid gap-1.5">
                <Label>Stok Awal</Label>
                <Input inputMode="numeric" type="number" min={0} value={opening} onChange={(e) => setOpening(e.target.value)} />
                <span className="text-[11px] text-muted-foreground">Masuk stok cabang aktif.</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan…" : isEdit ? "Simpan" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
