"use client";

import { useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { businessDate } from "@/lib/business-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { recordServisPayment } from "@/app/app/actions/cash";

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
  const [kasDate, setKasDate] = useState(() => businessDate());
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sisa = estimasi != null ? Math.max(0, estimasi - totalPaid) : null;

  // `recordServisPayment` menolak pembayaran baru begitu total yang dibayar
  // sudah mencapai estimasi, tanpa melihat nominalnya. Dulu form tetap
  // menampilkan semua field dan menjanjikan "melebihi sisa tetap bisa
  // disimpan", jadi kasir isi form lalu/server menolak dengan "sudah lunas" -
  // dua pesan bertentangan di layar yang sama.
  //
  // short: `sisa === 0` hanya terjadi kalau ada estimasi. Servis tanpa
  // estimasi (null) tetap punya form terbuka, karena tidak ada patokan lunas
  // dan kasir yang menilainya.
  const sudahLunas = sisa === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (amount === "" || Number(amount) <= 0) { setError("Nominal harus >0"); return; }
    setLoading(true);
    try {
      const res = await recordServisPayment({
        servisId,
        amount: Number(amount),
        metode,
        kasDate,
        note: keterangan.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSuccess?.(res.data.totalPaid);
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
          <Badge variant="outline">Estimasi {formatCurrencyPlain(estimasi)}</Badge>
          <Badge variant="secondary">Terbayar {formatCurrencyPlain(totalPaid)}</Badge>
          {sisa !== null && <Badge variant={sisa === 0 ? "default" : "outline"}>Sisa {formatCurrencyPlain(sisa)}</Badge>}
        </div>
      )}

      {sudahLunas ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Servis ini sudah lunas. Pembayaran baru akan ditolak server, jadi form
            tidak ditampilkan. Kalau ada selisih, catat lewat adjustment kas -
            bukan di sini.
          </p>
          {onClose && <Button type="button" variant="outline" onClick={onClose}>Tutup</Button>}
        </div>
      ) : (
        <>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <div className="grid gap-1.5">
        <Label>Nominal *</Label>
        <Input type="number" min={1} placeholder="Jumlah bayar, cth 150000" value={amount} onChange={(e) => { const v = e.target.value; if (v === "") setAmount(""); else setAmount(Math.max(0, Number(v))); }} />
        {amount !== "" && sisa !== null && Number(amount) > sisa && <p className="text-[11px] text-amber-600 dark:text-amber-400">Melebihi sisa estimasi. Server akan menerimanya selama total terbayar belum mencapai estimasi - kalau tidak, tolak dan catat lewat adjustment kas.</p>}
      </div>
      <div className="grid gap-1.5">
        <Label>Metode *</Label>
        <Select value={metode} onValueChange={(v) => setMetode(v as any)}>
          <SelectTrigger className="dark:text-white data-placeholder:text-white/70"><SelectValue className="dark:text-white" /></SelectTrigger>
          <SelectPopup className="dark scheme-dark bg-popover text-popover-foreground">
            {METODE.map((m) => <SelectItem key={m} value={m} className="text-popover-foreground dark:text-white data-highlighted:text-white data-highlighted:bg-white/10">{m}</SelectItem>)}
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
        </>
      )}
    </form>
  );
}