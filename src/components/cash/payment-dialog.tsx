"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { payServis, type FrontlinerQueueItem } from "@/app/app/actions/cash";

const METHODS = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"] as const;

/**
 * Pembayaran servis: keranjang satu item + pilihan metode.
 *
 * Jalur datanya membuat baris `cervise_sales` dengan `servis_id` terisi —
 * itu pengait yang membuat servis tidak terhitung dua kali di Laporan Shift.
 * Baris `finance_tx` sengaja tidak dibuat di sini; penjualan sudah dihitung
 * lewat tabel `sales`, jadi menambahnya akan menghitung dua kali.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  service,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  service: FrontlinerQueueItem | null;
  onPaid?: () => void;
}) {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Tunai");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset saat dialog dibuka untuk servis yang berbeda. Dilakukan di render
  // (bukan effect) supaya tidak ada setState sinkron saat mount.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && service && openedFor !== service.id) {
    setOpenedFor(service.id);
    setMethod("Tunai");
    setAmount(String(service.price));
    setNote("");
    setError(null);
  }
  if (!open && openedFor !== null) {
    setOpenedFor(null);
  }

  if (!service) return null;

  const due = service.price;
  const value = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isInteger(value) && value >= 0;
  const shortfall = amountValid && value < due ? due - value : 0;

  const submit = async () => {
    if (!amountValid) {
      setError("Nominal harus angka bulat dan tidak boleh negatif");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await payServis({
      servisId: service.id,
      paymentMethod: method,
      amount: value,
      note: note.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onOpenChange(false);
    toast.success(
      shortfall > 0
        ? `Pembayaran dicatat. Kurang ${formatCurrencyPlain(shortfall)} — sisanya dicatat manual.`
        : "Pembayaran dicatat",
    );
    onPaid?.();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran Servis</DialogTitle>
          <DialogDescription>
            {service.customerName ? `${service.customerName} · ` : ""}
            {service.serviceNumber ?? "Tanpa nomor"} · {service.device}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/60">
            <div className="flex items-baseline justify-between border-b border-border/60 px-3 py-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                Keranjang
              </span>
              <span className="text-xs text-muted-foreground">{service.status}</span>
            </div>
            <div className="flex items-baseline justify-between px-3 py-2">
              <span className="truncate">{service.device}</span>
              <span className="shrink-0 font-mono text-sm">{formatCurrencyPlain(due)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-border/60 px-3 py-2 font-medium">
              <span>Total</span>
              <span className="font-mono">{formatCurrencyPlain(due)}</span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pay-method">Metode pembayaran</Label>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    method === value
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:bg-foreground/[0.05]",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">Diterima (Rp)</Label>
            <Input
              id="pay-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className="font-mono"
            />
            {shortfall > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Kurang {formatCurrencyPlain(shortfall)}. Catat sisanya lewat Transaksi Kas Manual
                supaya masuk Laporan Shift.
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pay-note">Catatan (opsional)</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Tersimpan di catatan penjualan"
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} disabled={saving || !amountValid}>
            {saving ? "Menyimpan..." : "Simpan Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
