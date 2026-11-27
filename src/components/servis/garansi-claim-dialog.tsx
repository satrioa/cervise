"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { createGaransiClaim } from "@/app/app/garansi/actions";
import { canClaimGaransi } from "@/lib/operational/garansi-claim";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClaimTarget = {
  id: string;
  invoiceNo: string;
  device: string;
  customer: { name: string; phone: string };
  garansiUntil: string | null;
  garansiValue: number;
  garansiUnit: "hari" | "bulan" | "tahun";
  status: string;
};

type Props = {
  target: ClaimTarget | null;
  hasOpenClaim: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (serviceId: string) => void;
};

export function GaransiClaimDialog({ target, hasOpenClaim, open, onOpenChange, onCreated }: Props) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibility = target
    ? canClaimGaransi({
        status: target.status,
        garansiUntil: target.garansiUntil,
        garansiValue: target.garansiValue,
        garansiUnit: target.garansiUnit,
        hasOpenClaim,
      })
    : null;

  const submit = async () => {
    if (!target || saving) return;
    if (reason.trim().length < 3) {
      setError("Alasan klaim wajib diisi (minimal 3 karakter)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createGaransiClaim({ originalServiceId: target.id, reason });
      setReason("");
      onOpenChange(false);
      onCreated(result.serviceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat klaim garansi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setError(null); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Klaim garansi</DialogTitle>
          <DialogDescription>
            {target ? `${target.device} · ${target.invoiceNo} · ${target.customer.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Sisa garansi</span><span className="font-medium">{target.garansiUntil ? format(new Date(target.garansiUntil), "d MMM yyyy", { locale: localeId }) : "Belum aktif"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Servis klaim</span><span className="font-medium">Dibuat otomatis</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Biaya</span><span className="font-medium text-emerald-700">Gratis (Rp 0)</span></div>
          </div>
        ) : null}

        {eligibility && !eligibility.eligible ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{eligibility.reason}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="alasan-klaim">Alasan klaim</Label>
            <Textarea
              id="alasan-klaim"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: kerusakan yang sama muncul lagi setelah perbaikan"
              rows={3}
              disabled={saving}
            />
          </div>
        )}

        {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={() => void submit()} disabled={saving || !eligibility?.eligible || reason.trim().length < 3}>
            {saving ? "Menyimpan…" : "Kirim klaim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
