"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrencyPlain } from "@/lib/format";
import {
  ArrowLeftIcon,
  WalletIcon,
  CreditCardIcon,
  Building2Icon,
  QrCodeIcon,
  SmartphoneIcon,
  QrCode,
  CircleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as CossButton } from "@/components/ui/coss-button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardFrame, CardFrameAction, CardFrameHeader, CardFrameTitle } from "@/components/ui/card";
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
 * Tahap pembayaran. Di layar sempit metode tampil sebagai rail horizontal supaya
 * field langsung terlihat; mulai lebar panel 512px (`@lg`) metode jadi daftar
 * vertikal di kiri dan detail di kanan. Lebar panel dipakai, bukan lebar layar,
 * karena panel yang sama juga dipakai di dalam dialog servis.
 *
 * Detail non-tunai tidak punya kolom database sendiri, jadi dirangkai ke `notes`
 * lewat buildPaymentNote supaya ikut tercetak di nota.
 */
export function PenjualanPaymentPanel({
  metode,
  onMetodeChange,
  subtotal,
  total,
  onSelesai,
  saving,
  submitLabel,
  subtotalLabel,
  subtotalHint,
  embedded,
  onBack,
  customerName,
  itemCount,
}: {
  metode: string;
  onMetodeChange: (metode: string) => void;
  subtotal: number;
  total: number;
  onSelesai: (outcome: PaymentOutcome) => void;
  saving: boolean;
  /** Judul tombol aksi. Default "Selesai Dibayar". */
  submitLabel?: string;
  /** Label baris subtotal. Servis memakai "Nominal Bayar". */
  subtotalLabel?: string;
  /** Keterangan kecil di samping label subtotal, mis. "Estimasi Rp350.000". */
  subtotalHint?: string;
  /** Dipakai di dalam dialog: tinggi mengikuti wadahnya, bukan tinggi layar. */
  embedded?: boolean;
  /** Tombol kembali ke keranjang; dipakai alur mobile. */
  onBack?: () => void;
  /** Nama customer di header; di HP kolom rincian pesanan tidak terlihat. */
  customerName?: string;
  /** Jumlah item di header, penanda pesanan mana yang sedang dibayar. */
  itemCount?: number;
}) {
  const submitText = submitLabel ?? "Selesai Dibayar";
  const isEmbedded = embedded ?? false;
  const [cashDigits, setCashDigits] = useState("");
  const [bank, setBank] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [reference, setReference] = useState("");
  const [wallet, setWallet] = useState("GoPay");
  const [qrisConfirmed, setQrisConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashValue = Number(cashDigits || 0);
  const shortfall = Math.max(0, total - cashValue);
  const change = Math.max(0, cashValue - total);
  const hasDifference = subtotal !== total;

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

  const detail = () => {
    if (metode === "Tunai") {
      return (
        <div className="space-y-3">
          <Field>
            <FieldLabel htmlFor="cash-amount">Uang Diterima</FieldLabel>
            {/* Input bawaan menyetel tinggi di elemen dalam, jadi kotak besar ini
                dirangkai sendiri supaya angka dan "Rp" benar-benar sebaris. */}
            <div className="flex h-14 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-base shadow-xs/5 transition-shadow has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/24 dark:bg-input/32 sm:text-sm">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">Rp</span>
              <input
                id="cash-amount"
                inputMode="numeric"
                autoFocus
                value={money(cashDigits)}
                onChange={(e) => { setCashDigits(onlyDigits(e.target.value)); setError(null); }}
                placeholder={money(String(total))}
                aria-invalid={Boolean(error)}
                className="h-full min-w-0 flex-1 bg-transparent text-right font-mono text-2xl font-semibold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Total tagihan {formatCurrencyPlain(total)}</p>
          </Field>
          <div className={cn("grid gap-2", chips.length > 1 && "grid-cols-2")}>
            {chips.map((value, index) => (
              <CossButton
                key={value}
                type="button"
                variant={index === 0 ? "secondary" : "outline"}
                size="lg"
                className={cn("font-mono tabular-nums", index === 0 && chips.length > 1 && "col-span-2")}
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
        <div className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="debit-bank">Bank / EDC</FieldLabel>
            <Select value={bank} onValueChange={(v) => setBank(String(v))}>
              <SelectTrigger id="debit-bank" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="debit-ref">No. Referensi / Approval</FieldLabel>
            <Input id="debit-ref" inputMode="numeric" aria-invalid={Boolean(error)} value={reference} onChange={(e) => { setReference(e.target.value); setError(null); }} className="font-mono" placeholder="123456" />
          </Field>
        </div>
      );
    }

    if (metode === "Transfer") {
      return (
        <div className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="transfer-bank">Bank Pengirim</FieldLabel>
            <Select value={bank} onValueChange={(v) => setBank(String(v))}>
              <SelectTrigger id="transfer-bank" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-account">No. Rekening Pengirim</FieldLabel>
            <Input id="transfer-account" inputMode="numeric" aria-invalid={Boolean(error)} value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setError(null); }} className="font-mono" placeholder="4260586071" />
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-name">Nama Pengirim (opsional)</FieldLabel>
            <Input id="transfer-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Nama pemilik rekening" />
          </Field>
        </div>
      );
    }

    if (metode === "QRIS") {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
              <QrCode className="size-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Menunggu dana masuk</p>
              <p className="text-xs text-muted-foreground">
                Minta customer scan QRIS, lalu cocokkan nominal {formatCurrencyPlain(total)} dengan mutasi.
              </p>
            </div>
          </div>
          <label
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors",
              qrisConfirmed ? "border-foreground bg-muted/50" : "border-input hover:bg-muted/20",
            )}
          >
            <Checkbox checked={qrisConfirmed} onCheckedChange={(v) => { setQrisConfirmed(Boolean(v)); setError(null); }} />
            Dana QRIS sudah masuk
          </label>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="wallet-provider">Provider</FieldLabel>
          <Select value={wallet} onValueChange={(v) => setWallet(String(v))}>
            <SelectTrigger id="wallet-provider" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{WALLETS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="wallet-ref">No. HP / Referensi</FieldLabel>
          <Input id="wallet-ref" aria-invalid={Boolean(error)} value={reference} onChange={(e) => { setReference(e.target.value); setError(null); }} className="font-mono" placeholder="0812..." />
        </Field>
      </div>
    );
  };

  return (
    <CardFrame
      className={cn(
        "@container flex w-full flex-col overflow-hidden",
        isEmbedded
          ? "min-h-0 flex-1"
          : "h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] lg:h-full lg:max-h-full animate-in fade-in-0 slide-in-from-right-2 duration-300",
      )}
    >
      {!isEmbedded && (
        <CardFrameHeader className="grid-rows-1 py-3 px-4">
          <CardFrameTitle className="flex min-w-0 items-center gap-2 text-[15px]">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Kembali ke keranjang"
                className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
            ) : null}
            <span className="truncate">Pembayaran</span>
            {customerName ? (
              <span className="truncate text-xs font-normal text-muted-foreground">· {customerName}</span>
            ) : null}
          </CardFrameTitle>
          {itemCount ? (
            <CardFrameAction>
              <Badge variant="secondary" size="sm" className="font-mono tabular-nums">{itemCount} item</Badge>
            </CardFrameAction>
          ) : null}
        </CardFrameHeader>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none before:hidden">
        <div className="flex-1 min-h-0 p-3 grid grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-y-auto @lg:grid-cols-[minmax(0,16rem)_1fr] @lg:overflow-hidden">
          <div
            role="group"
            aria-label="Metode pembayaran"
            className="flex min-w-0 gap-2 overflow-x-auto scrollbar-none p-0.5 @lg:grid @lg:auto-rows-min @lg:content-start @lg:grid-cols-1 @lg:overflow-y-auto @lg:overflow-x-hidden @lg:p-0 @lg:pr-1"
          >
            {METODE_META.map((m) => {
              const Icon = m.icon;
              const selected = metode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => pickMetode(m.value)}
                  aria-pressed={selected}
                  className={cn(
                    "relative flex min-w-[7rem] shrink-0 items-center gap-2 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background @lg:w-full @lg:min-w-0 @lg:shrink @lg:gap-3 @lg:p-3",
                    selected ? "border-foreground bg-muted/50" : "border-input bg-card hover:bg-muted/20",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                      selected ? "border-foreground bg-foreground text-background" : "border-input/60 bg-muted/30",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-tight">{m.value}</span>
                    <span className="hidden truncate text-[11px] text-muted-foreground @lg:block">{m.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="@lg:flex-1 @lg:min-h-0 @lg:overflow-y-auto @lg:pr-1">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Detail {metode}
            </div>
            {detail()}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t p-3">
          {hasDifference && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {subtotalLabel ?? "Subtotal"}
                  {subtotalHint ? <span className="ml-1 text-[11px]">· {subtotalHint}</span> : null}
                </span>
                <span className="font-mono tabular-nums">{formatCurrencyPlain(subtotal)}</span>
              </div>
              <Separator className="my-1" />
            </>
          )}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total</div>
              {!hasDifference && subtotalHint ? (
                <div className="truncate text-[11px] text-muted-foreground">{subtotalHint}</div>
              ) : null}
            </div>
            <div className="font-mono text-xl font-bold tabular-nums">{formatCurrencyPlain(total)}</div>
          </div>
          {metode === "Tunai" && cashDigits !== "" && (
            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uang Diterima</span>
                <span className="font-mono text-sm tabular-nums">{formatCurrencyPlain(cashValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{shortfall > 0 ? "Kurang" : "Kembalian"}</span>
                <span className={cn("font-mono text-lg font-semibold tabular-nums", shortfall > 0 && "text-destructive")}>
                  {formatCurrencyPlain(shortfall > 0 ? shortfall : change)}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs text-destructive">
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button className="w-full" size="lg" onClick={submit} disabled={saving} loading={saving}>{submitText}</Button>
        </div>
      </Card>
    </CardFrame>
  );
}
