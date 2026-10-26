"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrencyPlain } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenjualanPaymentPanel } from "@/components/penjualan/penjualan-payment-panel";
import { addPembayaran } from "@/app/app/servis/actions";

type Metode = "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet";

type Props = {
  servisId: string;
  /** Patokan tagihan. Null = bahasa accordion, nominal diisi manual. */
  estimasi?: number | null;
  /** Sudah dibayar (dari ledger kas). */
  totalPaid?: number;
  onSuccess?: (total: number) => void;
  onClose?: () => void;
};

/**
 * Pembayaran servis memakai panel yang sama dengan penjualan.
 *
 * Yang membedakan hanya sumber nomornya: penjualan memakai total keranjang,
 * servis memakai sisa estimasi (`price_estimasi` -ledger kas). Patokan lunas
 * di server juga `price_estimasi`, jadi menyamakan UI saja sudah cukup.
 *
 * Kode promo disembunyikan: diskon penjualan tidak berlaku untuk servis.
 */
export function ServisPaymentPanel({ servisId, estimasi, totalPaid = 0, onSuccess, onClose }: Props) {
  const [metode, setMetode] = useState<Metode>("Tunai");
  const [saving, setSaving] = useState(false);
  const [manualAmount, setManualAmount] = useState("");

  const punyaEstimasi = estimasi != null && estimasi > 0;
  const sisa = punyaEstimasi ? Math.max(0, estimasi - totalPaid) : 0;

  // Tanpa estimasi tidak ada patokan: kasir yang menentukan nominalnya.
  const manual = Number(manualAmount.replace(/\D/g, "")) || 0;
  const total = punyaEstimasi ? sisa : manual;

  // Sudah lunas: form disembunyikan supaya tidak ada tekanan menekan tombol
  // yang pasti ditolak server.
  if (punyaEstimasi && sisa === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Estimasi {formatCurrencyPlain(estimasi ?? 0)}</Badge>
          <Badge variant="secondary">Terbayar {formatCurrencyPlain(totalPaid)}</Badge>
          <Badge>Lunas</Badge>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          Servis ini sudah lunas. Tidak ada yang perlu ditagih lagi.
        </div>
        {onClose && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Tutup</Button>
          </div>
        )}
      </div>
    );
  }

  const handleSelesai = async (outcome: { paid: number; notes: string }) => {
    setSaving(true);
    try {
      const res = await addPembayaran({
        servisId,
        amount: outcome.paid,
        metode,
        keterangan: outcome.notes,
      });
      toast.success("Pembayaran tersimpan");
      onSuccess?.(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pembayaran");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {punyaEstimasi ? (
          <>
            <Badge variant="outline">Estimasi {formatCurrencyPlain(estimasi ?? 0)}</Badge>
            <Badge variant="secondary">Terbayar {formatCurrencyPlain(totalPaid)}</Badge>
            <Badge variant="outline">Sisa {formatCurrencyPlain(sisa)}</Badge>
          </>
        ) : (
          <div className="w-full space-y-1.5">
            <Label className="text-xs">Nominal bayar *</Label>
            <Input
              inputMode="numeric"
              placeholder="Jumlah bayar, cth 150000"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value.replace(/\D/g, ""))}
              className="h-10 font-mono text-lg tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">Estimasi belum diisi, jadi nominal ditentukan manual di sini.</p>
          </div>
        )}
      </div>

      {total > 0 && (
        <PenjualanPaymentPanel
          metode={metode}
          onMetodeChange={(m) => setMetode(m as Metode)}
          subtotal={total}
          total={total}
          onSelesai={handleSelesai}
          saving={saving}
          submitLabel="Simpan Pembayaran"
          showPromo={false}
          embedded
        />
      )}
    </div>
  );
}
