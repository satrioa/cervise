"use client";

import { useState } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import {
  WalletIcon,
  CreditCardIcon,
  Building2Icon,
  QrCodeIcon,
  SmartphoneIcon,
  CheckCircle2Icon,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as CossButton } from "@/components/ui/coss-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardFrame, CardFrameHeader, CardFrameTitle, CardPanel } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { haptic } from "@/lib/haptic";
import { buildPaymentNote } from "@/lib/sales/payment-note";

export const METODE_META: { value: string; icon: LucideIcon; desc: string }[] = [
  { value: "Tunai", icon: WalletIcon, desc: "Cash" },
  { value: "QRIS", icon: QrCodeIcon, desc: "Scan QR" },
  { value: "Debit", icon: CreditCardIcon, desc: "EDC" },
  { value: "E-Wallet", icon: SmartphoneIcon, desc: "GoPay / OVO" },
  { value: "Transfer", icon: Building2Icon, desc: "Bank" },
];

const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga", "Permata", "Lainnya"];
const WALLETS = ["GoPay", "OVO", "DANA", "ShopeePay", "Lainnya"];

export type PaymentOutcome = { paid: number; notes: string };

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const money = (digits: string) => (digits ? new Intl.NumberFormat("id-ID").format(Number(digits)) : "");
const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

/**
 * Tahap pembayaran, dua kolom: metode di kiri, detail metode + ringkasan di
 * kanan. Detail non-tunai tidak punya kolom database sendiri, jadi dirangkai ke
 * `notes` lewat buildPaymentNote supaya ikut tercetak di nota.
 */
export function PenjualanPaymentPanel({
  metode,
  onMetodeChange,
  subtotal,
  total,
  onSelesai,
  saving,
  submitLabel,
  showPromo,
  embedded,
}: {
  metode: string;
  onMetodeChange: (metode: string) => void;
  subtotal: number;
  total: number;
  onSelesai: (outcome: PaymentOutcome) => void;
  saving: boolean;
  /** Judul tombol aksi. Default "Selesai Dibayar". */
  submitLabel?: string;
  /** Sembunyikan blok kode promo. Promo hanya milik penjualan. */
  showPromo?: boolean;
  /** Dipakai di dalam dialog: tinggi mengikuti wadahnya, bukan tinggi layar. */
  embedded?: boolean;
}) {
  const submitText = submitLabel ?? "Selesai Dibayar";
  const promoVisible = showPromo ?? true;
  const isEmbedded = embedded ?? false;
  const [cashDigits, setCashDigits] = useState("");
  const [bank, setBank] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [reference, setReference] = useState("");
  const [wallet, setWallet] = useState("GoPay");
  const [qrisConfirmed, setQrisConfirmed] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cashValue = Number(cashDigits || 0);
  const change = Math.max(0, cashValue - total);

  // Chip cepat: uang pas, lalu pembulatan ke atas 50rb dan 100rb.
  const chips = [...new Set([total, roundUp(total, 50_000), roundUp(total, 100_000)])].filter((v) => v >= total);

  const pickMetode = (value: string) => {
    onMetodeChange(value);
    setError(null);
    haptic(15);
  };

  const validate = () => {
    if (metode === "Tunai") {
      if (!cashDigits) return "Isi uang diterima";
      if (cashValue < total) return "Uang diterima kurang dari total";
    }
    if (metode === "Debit" && !reference.trim()) return "Isi no. referensi / approval EDC";
    if (metode === "Transfer" && !accountNumber.trim()) return "Isi no. rekening pengirim";
    if (metode === "E-Wallet" && !reference.trim()) return "Isi nomor HP / referensi e-wallet";
    if (metode === "QRIS" && !qrisConfirmed) return "Centang konfirmasi dana QRIS sudah masuk";
    return null;
  };

  const submit = () => {
    const message = validate();
    if (message) {
      setError(message);
      haptic([20, 30, 20]);
      return;
    }
    setError(null);
    onSelesai({
      paid: metode === "Tunai" ? cashValue : total,
      notes: buildPaymentNote({
        method: metode,
        total,
        cashReceived: metode === "Tunai" ? cashValue : null,
        bank,
        accountNumber,
        accountName,
        reference,
        wallet,
      }),
    });
  };

  // Discounts must come from a server-validated promo table. Hard-coded codes
  // here let the browser invent its own discount, so none are accepted.
  const applyPromo = () => {
    if (!promoCode.trim()) { setPromoError("Masukkan kode promo"); return; }
    setPromoError("Kode promo belum tersedia. Beri diskon manual per item atau hubungi admin.");
    haptic([20, 30, 20]);
  };

  const detail = () => {
    if (metode === "Tunai") {
      return (
        <div className="space-y-2">
          <Label htmlFor="cash-amount">Uang Diterima</Label>
          <Input
            id="cash-amount"
            inputMode="numeric"
            autoFocus
            value={money(cashDigits)}
            onChange={(e) => { setCashDigits(onlyDigits(e.target.value)); setError(null); }}
            placeholder={formatCurrencyPlain(total)}
            className="h-14 text-right font-mono text-3xl tabular-nums"
            nativeInput
          />
          <div className="flex flex-wrap gap-2">
            {chips.map((value) => (
              <CossButton
                key={value}
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 font-mono tabular-nums"
                onClick={() => { setCashDigits(String(value)); setError(null); }}
              >
                {value === total ? "Uang pas" : money(String(value))}
              </CossButton>
            ))}
          </div>
        </div>
      );
    }

    if (metode === "Debit") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bank / EDC</Label>
              <Select value={bank} onValueChange={(v) => setBank(String(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debit-ref">No. Referensi / Approval</Label>
              <Input id="debit-ref" inputMode="numeric" value={reference} onChange={(e) => { setReference(e.target.value); setError(null); }} className="font-mono" placeholder="123456" />
            </div>
          </div>
        </div>
      );
    }

    if (metode === "Transfer") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bank Pengirim</Label>
              <Select value={bank} onValueChange={(v) => setBank(String(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-account">No. Rekening Pengirim</Label>
              <Input id="transfer-account" inputMode="numeric" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setError(null); }} className="font-mono" placeholder="4260586071" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transfer-name">Nama Pengirim (opsional)</Label>
            <Input id="transfer-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Nama pemilik rekening" />
          </div>
        </div>
      );
    }

    if (metode === "QRIS") {
      return (
        <div className="space-y-3">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 py-8 text-muted-foreground">
            <QrCode className="size-10" />
            <p className="text-xs">Minta customer scan QRIS, lalu pastikan notifikasi dana masuk.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={qrisConfirmed} onCheckedChange={(v) => { setQrisConfirmed(Boolean(v)); setError(null); }} />
            Dana QRIS sudah masuk
          </label>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={wallet} onValueChange={(v) => setWallet(String(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{WALLETS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-ref">No. HP / Referensi</Label>
            <Input id="wallet-ref" value={reference} onChange={(e) => { setReference(e.target.value); setError(null); }} className="font-mono" placeholder="0812..." />
          </div>
        </div>
      </div>
    );
  };

  return (
    <CardFrame className={isEmbedded ? "flex flex-col h-auto max-h-full w-full overflow-hidden" : "flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] w-full overflow-hidden lg:h-full lg:max-h-full animate-in fade-in-0 slide-in-from-right-2 duration-300"}>
      <CardFrameHeader className="grid-rows-1 py-3 px-4">
        <CardFrameTitle className="text-[15px]">Pembayaran</CardFrameTitle>
      </CardFrameHeader>

      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none before:hidden">
        <div className={"flex-1 min-h-0 overflow-y-auto p-3 grid content-start gap-3 " + (isEmbedded ? "lg:grid-cols-[minmax(0,360px)_1fr] lg:overflow-visible" : "lg:grid-cols-[minmax(0,320px)_1fr] lg:overflow-hidden")}>
          <div className={"grid grid-cols-2 gap-2 content-start sm:grid-cols-3 lg:grid-cols-1 " + (isEmbedded ? "lg:overflow-visible lg:pr-0" : "lg:overflow-y-auto lg:pr-1")}>
            {METODE_META.map((m) => {
              const Icon = m.icon;
              const selected = metode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => pickMetode(m.value)}
                  className={"relative flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors sm:gap-3 sm:p-3 " + (selected ? "border-2 border-foreground bg-muted/40" : "border border-input bg-card hover:bg-muted/20")}
                >
                  <span className={"flex size-9 shrink-0 items-center justify-center rounded-lg border " + (selected ? "border-foreground bg-foreground text-background" : "bg-muted/30")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-tight">{m.value}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{m.desc}</span>
                  </span>
                  {selected && <CheckCircle2Icon className="absolute right-2 top-2 size-4" />}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">{detail()}</div>

            <div className="space-y-2 border-t pt-3 shrink-0">
              {promoVisible && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Kode Promo</Label>
                  <div className="flex gap-2">
                    <Input placeholder="CONTOH10" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="flex-1 font-mono uppercase h-8 text-sm" />
                    <Button size="sm" variant="outline" onClick={applyPromo} disabled={!promoCode.trim()}>Terapkan</Button>
                  </div>
                  {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                </div>
              )}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{formatCurrencyPlain(subtotal)}</span></div>
              {promoVisible && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Diskon Promo</span><span className="font-mono tabular-nums">{formatCurrencyPlain(0)}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
                <span className="font-mono text-lg font-bold tabular-nums">{formatCurrencyPlain(total)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm text-muted-foreground">Kembalian</span>
                <span className="font-mono text-base font-semibold tabular-nums">{formatCurrencyPlain(metode === "Tunai" ? change : 0)}</span>
              </div>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
              <Button className="w-full mt-2" onClick={submit} disabled={saving} loading={saving}>{submitText}</Button>
            </div>
          </div>
        </div>
      </Card>
    </CardFrame>
  );
}
