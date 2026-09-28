"use client";

import { useEffect, useState } from "react";
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
import type { ShiftReport } from "@/lib/operational/laporan-shift";
import { closeCashSession, getShiftPreview, type CashSessionRow } from "@/app/app/actions/cash";
import { ShiftReportView, VarianceRow } from "./shift-report";

type Step = "preview" | "closing" | "confirm";

/**
 * Tutup Toko, tiga tahap.
 *
 * 1. Preview Laporan Shift — saldo akhir belum diminta. Orang harus melihat
 *    angkanya dulu sebelum menginput uang fisik; kalau urutannya dibalik,
 *    yang diinput cuma tebakan.
 * 2. Saldo akhir fisik.
 * 3. Konfirmasi selisih + alasan (wajib kalau kurang).
 *
 * Tahap 3 computing ulang preview-nya: sejak tahap 1 masih ada transaksi yang
 * bisa masuk, jadi angka yang disimpan harus yang dibaca paling akhir.
 */
export function ClosingDialog({
  open,
  onOpenChange,
  session,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  session: CashSessionRow | null;
  onClosed?: () => void;
}) {
  const [step, setStep] = useState<Step>("preview");
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Dialog ini dibuka dari tombol, jadi reset state dilakukan di render bukan
  // di effect: `openedFor` berubah hanya saat dialog dibuka untuk sesi lain.
  if (open && openedFor !== session?.id) {
    setOpenedFor(session?.id ?? null);
    setStep("preview");
    setReport(null);
    setLoading(true);
    setClosing("");
    setReason("");
    setError(null);
  }
  if (!open && openedFor !== null) {
    setOpenedFor(null);
  }

  useEffect(() => {
    const id = session?.id;
    if (!open || !id) return;
    let cancelled = false;
    getShiftPreview(id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `id` sudah dipakai sebagai nilai, jadi dependensinya lengkap.
  }, [open, session?.id]);

  if (!session) return null;

  const closingValue = Number(closing);
  const closingValid = closing.trim() !== "" && Number.isInteger(closingValue) && closingValue >= 0;
  const expected = report?.totals.expected ?? 0;
  const variance = closingValid ? closingValue - expected : null;
  const reasonRequired = variance !== null && variance < 0;

  const submit = async () => {
    if (!closingValid) {
      setError("Saldo akhir harus angka bulat dan tidak boleh negatif");
      return;
    }
    if (reasonRequired && !reason.trim()) {
      setError("Selisih kurang wajib diberi alasan");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await closeCashSession({
      sessionId: session.id,
      closingBalance: closingValue,
      reason: reason.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onOpenChange(false);
    toast.success(
      result.data.variance === 0
        ? "Shift ditutup. Saldo sesuai."
        : "Shift ditutup dengan selisih tercatat.",
    );
    onClosed?.();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>
            {step === "preview" && "Tutup Toko — Preview Laporan"}
            {step === "closing" && "Tutup Toko — Saldo Akhir"}
            {step === "confirm" && "Tutup Toko — Konfirmasi"}
          </DialogTitle>
          <DialogDescription>
            {step === "preview" &&
              "Periksa angkanya dulu. Saldo akhir diminta setelah ini."}
            {step === "closing" && `Harus ada di laci: ${formatCurrencyPlain(expected)}`}
            {step === "confirm" && "Cek selisihnya sebelum menyimpan."}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Menghitung laporan shift...</p>
        ) : !report ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Laporan tidak tersedia.</p>
        ) : step === "preview" ? (
          <ShiftReportView report={report} />
        ) : step === "closing" ? (
          <div className="grid gap-2">
            <Label htmlFor="closing">Saldo akhir fisik di laci (Rp)</Label>
            <Input
              id="closing"
              inputMode="numeric"
              autoFocus
              value={closing}
              onChange={(event) => {
                setClosing(event.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && closingValid) setStep("confirm");
              }}
              placeholder="0"
              className="font-mono"
            />
            {closing ? (
              <p className="text-xs text-muted-foreground">
                {formatCurrencyPlain(Number(closing))} · harus ada {formatCurrencyPlain(expected)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Saldo akhir</span>
                <span className="font-mono">{formatCurrencyPlain(closingValue)}</span>
              </div>
              <VarianceRow variance={variance} reason={null} />
            </div>

            {reasonRequired ? (
              <div className="grid gap-1.5">
                <Label htmlFor="reason">Alasan selisih (wajib)</Label>
                <Textarea
                  id="reason"
                  rows={2}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setError(null);
                  }}
                  placeholder="Contoh: kembalian 500 tidak sempat dicatat"
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="reason">Catatan (opsional)</Label>
                <Textarea
                  id="reason"
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Tersimpan bersama laporan shift"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" ? (
            <Button onClick={() => setStep("closing")} disabled={loading || !report}>
              Lanjut isi saldo akhir
            </Button>
          ) : step === "closing" ? (
            <>
              <Button variant="outline" onClick={() => setStep("preview")} disabled={saving}>
                Kembali
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={!closingValid}>
                Lanjut
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("closing")} disabled={saving}>
                Kembali
              </Button>
              <Button onClick={submit} disabled={saving || (reasonRequired && !reason.trim())}>
                {saving ? "Menyimpan..." : "Tutup Toko"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
