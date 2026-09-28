"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { checkOpenCashSession, openCashSession, type CashSessionRow } from "@/app/app/actions/cash";

/**
 * Saldo awal wajib.
 *
 * Tidak bisa ditutup dengan Escape atau klik backdrop: tanpa saldo awal,
 * Laporan Shift tidak punya pijakan. Sesi hanya bisa ditutup lewat
 * tombol Tutup Toko di dashboard.
 *
 * `stale` memberi tahu ada shift lama yang belum ditutup. Index unik
 * satu-sesi-terbuka-per-karyawan akan menolak sesi baru, jadi pengguna
 * harus menutup shift lama dulu — dialog mengarahkan ke sana.
 */
function sessionDate(session: CashSessionRow): string {
  const opened = new Date(session.openAt);
  if (Number.isNaN(opened.getTime())) return "sebelumnya";
  return opened.toISOString().slice(0, 10);
}

export function OpeningBalanceDialog({
  onOpened,
  staffName,
}: {
  onOpened?: (session: CashSessionRow) => void;
  staffName?: string;
}) {
  const [open, setOpen] = useState(true);
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<CashSessionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkOpenCashSession().then((result) => {
      if (cancelled || !result.ok) return;
      if (result.data.current) {
        // Sudah punya sesi hari ini — tidak perlu dialog sama sekali.
        setOpen(false);
        onOpened?.(result.data.current);
        return;
      }
      setStale(result.data.stale);
    });
    return () => {
      cancelled = true;
    };
  }, [onOpened]);

  const submit = async () => {
    const value = Number(balance);
    if (!balance.trim() || !Number.isInteger(value) || value < 0) {
      setError("Saldo awal harus angka bulat dan tidak boleh negatif");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await openCashSession({ openingBalance: value });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setOpen(false);
    onOpened?.(result.data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Satu-satunya cara menutup: sesi berhasil dibuat.
        if (!next && !saving) return;
        setOpen(next);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saldo Awal Kas</DialogTitle>
          <DialogDescription>
            {staffName ? `${staffName} · ` : ""}Isi saldo uang di laci sebelum mulai shift. Angka
            ini jadi pijakan Laporan Shift.
          </DialogDescription>
        </DialogHeader>

        {stale ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <div className="font-medium">Shift {sessionDate(stale)} belum ditutup</div>
            <p className="mt-1 text-muted-foreground">
              Sesi lama masih terbuka. Tutup dulu supaya laporan hari itu lengkap —{" "}
              <Link href="/app/laporan/shift" className="underline underline-offset-2">
                buka Laporan Shift
              </Link>
              .
            </p>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="opening">Saldo awal (Rp)</Label>
          <Input
            id="opening"
            inputMode="numeric"
            autoFocus
            value={balance}
            onChange={(event) => {
              setBalance(event.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="0"
            className="font-mono"
          />
          {balance ? (
            <p className="text-xs text-muted-foreground">{formatCurrencyPlain(Number(balance))}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Menyimpan..." : "Buka Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
