"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { addPembayaran } from "@/app/app/servis/actions";

type Props = {
  servisId: string;
  estimasi?: number | null;
  totalPaid?: number;
  onSuccess?: (total: number) => void;
  onClose?: () => void;
};

const METODE = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"] as const;

export function ServisBayarForm({ servisId, estimasi, totalPaid = 0, onSuccess, onClose }: Props) {
  const [amount, setAmount] = useState<number | "">("");
  const [metode, setMetode] = useState<(typeof METODE)[number]>("Tunai");
  const [kasDate, setKasDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sisa = estimasi != null ? Math.max(0, estimasi - totalPaid) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (amount === "" || Number(amount) <= 0) { setError("Nominal harus >0"); return; }
    setLoading(true);
    try {
      const res = await addPembayaran({ servisId, amount: Number(amount), metode, kas_date: kasDate, keterangan: keterangan.trim() || undefined });
      onSuccess?.(res.total);
      setAmount("");
      setKeterangan("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pembayaran");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {estimasi != null && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Estimasi Rp {estimasi.toLocaleString("id-ID")}</Badge>
          <Badge variant="secondary">Terbayar Rp {totalPaid.toLocaleString("id-ID")}</Badge>
          {sisa !== null && <Badge variant={sisa === 0 ? "default" : "outline"}>Sisa Rp {sisa.toLocaleString("id-ID")}</Badge>}
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <div className="grid gap-1.5">
        <Label>Nominal *</Label>
        <Input type="number" min={1} placeholder="Jumlah bayar, cth 150000" value={amount} onChange={(e) => { const v = e.target.value; if (v === "") setAmount(""); else setAmount(Math.max(0, Number(v))); }} />
        {amount !== "" && sisa !== null && Number(amount) > sisa && <p className="text-[11px] text-amber-600">Melebihi sisa estimasi, tapi tetap bisa disimpan (mungkin ada tambahan part).</p>}
      </div>
      <div className="grid gap-1.5">
        <Label>Metode *</Label>
        <Select value={metode} onValueChange={(v) => setMetode(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectPopup>
            {METODE.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectPopup>
        </Select>
        <p className="text-[11px] text-muted-foreground">Aktif: Tunai, Debit, Transfer, QRIS, E-Wallet (pengaturan nanti untuk on/off).</p>
      </div>
      <div className="grid gap-1.5">
        <Label>Tanggal bayar *</Label>
        <Input type="date" value={kasDate} onChange={(e) => setKasDate(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>Keterangan (opsional)</Label>
        <Textarea placeholder="DP awal, pelunasan, dll" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2 justify-end">
        {onClose && <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Batal</Button>}
        <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Hanya admin/kasir boleh input. Pembayaran bisa DP awal atau di akhir.</p>
    </form>
  );
}
