"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyPlain } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addCashAdjustment } from "@/app/app/actions/cash";

/**
 * Saldo masuk atau keluar di luar penjualan: setoran owner, koreksi, pengeluaran
 * kecil.
 *
 * Menulis ke `finance_tx` dengan `source = 'kas_manual'`, bukan ke tabel
 * terpisah, supaya Laporan Shift, Arus Kas, dan Laporan Keuangan membaca angka
 * yang sama.
 */
export function AdjustmentDialog({
  open,
  onOpenChange,
  onSaved,
  defaultDirection = "pemasukan",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSaved?: () => void;
  defaultDirection?: "pemasukan" | "pengeluaran";
}) {
  const [direction, setDirection] = useState<"pemasukan" | "pengeluaran">(defaultDirection);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setAmount("");
    setDescription("");
    setError(null);
    setDirection(defaultDirection);
  };

  const submit = async () => {
    const value = Number(amount);
    if (!amount.trim() || !Number.isInteger(value) || value <= 0) {
      setError("Nominal harus angka bulat lebih dari nol");
      return;
    }
    if (!description.trim()) {
      setError("Keterangan wajib diisi");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addCashAdjustment({ direction, amount: value, description });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    reset();
    onOpenChange(false);
    toast.success(direction === "pemasukan" ? "Pemasukan dicatat" : "Pengeluaran dicatat");
    onSaved?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaksi Kas Manual</DialogTitle>
          <DialogDescription>
            Untuk pemasukan dan pengeluaran di luar penjualan, supaya Laporan Shift mencatatnya.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 p-1">
            {(["pemasukan", "pengeluaran"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  direction === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                {value === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="adj-amount">Nominal (Rp)</Label>
            <Input
              id="adj-amount"
              inputMode="numeric"
              autoFocus
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              placeholder="0"
              className="font-mono"
            />
            {amount ? (
              <p className="text-xs text-muted-foreground">{formatCurrencyPlain(Number(amount))}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="adj-desc">Keterangan</Label>
            <Textarea
              id="adj-desc"
              rows={2}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
              }}
              placeholder="Setoran owner, beli spidol, koreksi kembalian..."
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
