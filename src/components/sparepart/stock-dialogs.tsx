/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adjustStock, getBranchesForTransfer, transferStock } from "@/app/app/sparepart/actions";

export function StockAdjustDialog({
  open,
  onOpenChange,
  item,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: { id: string; name: string; sku: string } | null;
  onDone: () => void;
}) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setQty("1"); setNote(""); } }, [open]);
  const submit = async () => {
    const n = Math.floor(Number(qty) || 0);
    if (n <= 0) { toast.error("Qty harus >0"); return; }
    if (!item) return;
    setSaving(true);
    try {
      await adjustStock({ id: item.id, delta: n, notes: note.trim() || undefined });
      toast.success(`Stok ${item.name} +${n}`);
      onOpenChange(false);
      onDone();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal tambah stok"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Stok</DialogTitle>
          <DialogDescription>{item ? `${item.name} · ${item.sku}` : ""} — masuk sebagai pembelian.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Qty *</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Catatan</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Faktur / supplier (opsional)" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan…" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({
  open,
  onOpenChange,
  item,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: { id: string; name: string; sku: string } | null;
  onDone: () => void;
}) {
  const [qty, setQty] = useState("1");
  const [toBranch, setToBranch] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setQty("1"); setNote(""); setToBranch("");
    getBranchesForTransfer().then(setBranches).catch(() => setBranches([]));
  }, [open]);
  const submit = async () => {
    const n = Math.floor(Number(qty) || 0);
    if (n <= 0) { toast.error("Qty harus >0"); return; }
    if (!toBranch) { toast.error("Pilih cabang tujuan"); return; }
    if (!item) return;
    setSaving(true);
    try {
      await transferStock({ id: item.id, toBranchId: toBranch, qty: n, notes: note.trim() || undefined });
      toast.success(`Transfer ${n} × ${item.name}`);
      onOpenChange(false);
      onDone();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal transfer"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Stok</DialogTitle>
          <DialogDescription>{item ? `${item.name} · ${item.sku}` : ""} — pindah antar cabang.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Cabang tujuan *</Label>
            <Select value={toBranch} onValueChange={(v) => setToBranch(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
              <SelectPopup>
                {branches.length === 0 ? <SelectItem value="" disabled>Tidak ada cabang lain</SelectItem> : branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Qty *</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Catatan</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan transfer (opsional)" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Memindahkan…" : "Transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
