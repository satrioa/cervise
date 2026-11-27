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
import { playPageTransition } from "@/components/layout/page-transition";
import { friendlyErrorMessage } from "@/lib/error-message";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setAmount("");
    setDescription("");
    setError(null);
    setFieldErrors({});
    setDirection(defaultDirection);
  };

  const submit = async () => {
    const value = Number(amount);
    const nextErrors: Record<string, string> = {};
    if (!amount.trim() || !Number.isInteger(value) || value <= 0) {
      nextErrors.amount = "Nominal harus angka bulat lebih dari nol";
    }
    if (!description.trim()) {
      nextErrors.description = "Keterangan wajib diisi";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(Object.values(nextErrors)[0]);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addCashAdjustment({ direction, amount: value, description });
    if (!result.ok) {
      setError(friendlyErrorMessage(result.error));
      setSaving(false);
      return;
    }
    setSaving(false);
    reset();
    playPageTransition();
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
              aria-invalid={Boolean(fieldErrors.amount)}
              inputMode="numeric"
              autoFocus
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/\D/g, ""));
                setError(null);
                setFieldErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder="0"
              className="font-mono"
            />
            {amount ? (
              <p className="text-xs text-muted-foreground">{formatCurrencyPlain(Number(amount))}</p>
            ) : null}
            {fieldErrors.amount ? <p className="text-xs text-destructive">{fieldErrors.amount}</p> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="adj-desc">Keterangan</Label>
            <Textarea
              id="adj-desc"
              rows={2}
              aria-invalid={Boolean(fieldErrors.description)}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
                setFieldErrors((prev) => ({ ...prev, description: "" }));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
              }}
              placeholder="Setoran owner, beli spidol, koreksi kembalian..."
            />
            {fieldErrors.description ? <p className="text-xs text-destructive">{fieldErrors.description}</p> : null}
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
