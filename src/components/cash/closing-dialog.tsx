"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { printShiftThermal } from "./shift-thermal-print";

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
 *
 * Setelah shift tertutup, struk thermal ringkasannya otomatis dicetak. Cetak
 * terjadi setelah `closeCashSession` sukses, bukan sebelum: kalau simpan
 * gagal, tidak boleh ada struk untuk shift yang belum tertutup. Laporan yang
 * dicetak adalah hasil balikan server - angka yang sama dengan yang tersimpan
 * di snapshot, bukan angka lokal dari tahap 3.
 */
export function ClosingDialog({
  open,
  onOpenChange,
  session,
  initialReport = null,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  session: CashSessionRow | null;
  /**
   * Laporan yang sudah dimuat dashboard. Dipakai supaya preview tampil
   * seketika - tanpa ini dialog membuka dengan teks "Menghitung laporan
   * shift..." selama seluruh round-trip server selesai. Angkanya tetap
   * disegarkan di latar belakang saat dialog dibuka.
   */
  initialReport?: ShiftReport | null;
  onClosed?: () => void;
}) {
  const [step, setStep] = useState<Step>("preview");
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);
  // true saat angka awal sudah tampil tapi versi terbarunya masih diambil.
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  // Default-nya tetap cetak. Struk untuk laci, dan shift yang tutup
  // tanpa struk berarti laci tidak punya catatan hari itu - jadi yang
  // dicentang berarti "jangan", bukan "boleh".
  const [skipPrint, setSkipPrint] = useState(false);

  // Dialog ini dibuka dari tombol, jadi reset state dilakukan di render bukan
  // di effect: `openedFor` berubah hanya saat dialog dibuka untuk sesi lain.
  if (open && openedFor !== session?.id) {
    setOpenedFor(session?.id ?? null);
    setStep("preview");
    setReport(initialReport ?? null);
    setLoading(!initialReport);
    setRefreshing(Boolean(initialReport));
    setClosing("");
    setReason("");
    setError(null);
    // Box "jangan cetak" tidak ikut mewarisi pilihan sesi sebelumnya: sesi
    // berikutnya punya struk yang sendiri.
    setSkipPrint(false);
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
        // Kalau angka awal sudah tampil, error refresh tidak boleh mengosongkan
        // preview - cukup tampilkan pesannya di atas laporan yang ada.
        setError(result.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setReport(result.data);
      setLoading(false);
      setRefreshing(false);
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

    // Cetak setelah dialog ditutup. `printShiftThermal` membuka dialog cetak
    // browser yang memblokir thread - dengan dialog Tutup Toko masih terbuka,
    // akan muncul dua dialog bertumpuk dan yang jadi TUJUHAN tidak jelas.
    // Urutannya: tutup dialog dulu, baru cetak.
    if (!skipPrint) {
      const printed = printShiftThermal(result.data);
      if (!printed) {
        toast.error("Shift ditutup, tapi struk thermal gagal dibuat. Cetak manual dari Laporan Shift.");
      }
    }
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
            {step === "preview" && (
              <>
                Periksa angkanya dulu. Saldo akhir diminta setelah ini.
                {refreshing ? <span className="ml-1 opacity-60">Memperbarui…</span> : null}
              </>
            )}
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

            {/* Opt-out cetak, hanya di tahap konfirmasi. Bukan di tahap 1
                karena di situ belum ada yang diputuskan, dan tidak di footer
                karena keduanya sudah punya konteks sendiri. Yang dicatat di
                sini adalah struk yang akan keluar begitu tombol ditekan. */}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 hover:bg-foreground/[0.03]">
              <Checkbox
                checked={skipPrint}
                onCheckedChange={(value) => setSkipPrint(value === true)}
                className="mt-0.5"
                aria-label="Jangan cetak otomatis"
              />
              <span className="text-sm leading-snug">
                Jangan cetak otomatis
                <span className="block text-xs text-muted-foreground">
                  Setelah ditutup, ringkasan shift dicetak ke printer thermal. Centang ini kalau
                  printer tidak terhubung atau struk sudah diambil dari laporan.
                </span>
              </span>
            </label>
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
