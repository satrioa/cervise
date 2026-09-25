"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import { MinusIcon, PlusIcon, TrashIcon, PackageIcon, ScanIcon, FolderIcon, WalletIcon, CreditCardIcon, Building2Icon, QrCodeIcon, SmartphoneIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameAction,
  CardPanel,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { haptic } from "@/lib/haptic";
import { createSale, type ProductRow } from "@/app/app/penjualan/actions";
import { searchCustomersByPhone, createCustomer } from "@/app/app/customer/actions";
import { cn } from "@/lib/utils";

const METODE = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"] as const;
const METODE_META: { value: string; icon: any; desc: string }[] = [
  { value: "Tunai", icon: WalletIcon, desc: "Cash" },
  { value: "Debit", icon: CreditCardIcon, desc: "EDC" },
  { value: "Transfer", icon: Building2Icon, desc: "Bank" },
  { value: "QRIS", icon: QrCodeIcon, desc: "Scan QR" },
  { value: "E-Wallet", icon: SmartphoneIcon, desc: "GoPay / OVO" },
];
type CartItem = { product: ProductRow; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string };

export function PenjualanCartPanel({ onSuccess, customerId, customerPhone, customerPhoneSetter, customerIdSetter }: { onSuccess: () => void; customerId: string | null; customerPhone: string; customerPhoneSetter?: (v: string) => void; customerIdSetter?: (v: string | null) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metode, setMetode] = useState<string>("Tunai");
  const [saving, setSaving] = useState(false);
  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.qty * c.unit_price, 0), [cart]);
  const [promoCode, setPromoCode] = useState("");
  const [promoDisc, setPromoDisc] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const total = useMemo(() => Math.max(0, subtotal - promoDisc), [subtotal, promoDisc]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [showNameField, setShowNameField] = useState(false);
  const [phoneResults, setPhoneResults] = useState<any[]>([]);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const phoneDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (phoneDebounceRef.current) window.clearTimeout(phoneDebounceRef.current);
    const term = customerPhone.trim().replace(/\D/g, "");
    if (term.length < 3) {
      setPhoneResults([]);
      setPhoneSearching(false);
      return;
    }
    setPhoneSearching(true);
    phoneDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchCustomersByPhone(customerPhone);
        setPhoneResults(res);
      } catch {
        setPhoneResults([]);
      } finally {
        setPhoneSearching(false);
      }
    }, 300);
    return () => {
      if (phoneDebounceRef.current) window.clearTimeout(phoneDebounceRef.current);
    };
  }, [customerPhone]);

  if (typeof window !== "undefined") {
    (window as any).__penjualanAddToCart = (p: ProductRow) => {
      if (p.stock_qty <= 0) { toast.error(`${p.name} stok habis`); haptic([30, 50, 30]); return; }
      let didAdd = false;
      let isNew = false;
      setCart((prev) => {
        const idx = prev.findIndex((c) => c.product.id === p.id);
        if (idx >= 0) {
          const cur = prev[idx]; if (cur.qty + 1 > p.stock_qty) { toast.error("Melebihi stok"); haptic([20, 30, 20]); return prev; }
          const next = [...prev]; next[idx] = { ...cur, qty: cur.qty + 1 }; didAdd = true; return next;
        }
        didAdd = true; isNew = true;
        return [...prev, { product: p, qty: 1, unit_price: p.price }];
      });
      queueMicrotask(() => {
        if (didAdd) haptic(isNew ? 50 : 20);
      });
    };
  }

  const setQty = (id: string, qty: number) => {
    haptic(15);
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty: Math.max(1, Math.min(qty, c.product.stock_qty)) } : c));
  };
  const setUnitPrice = (id: string, price: number) => setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, unit_price: Math.max(0, price) } : c));

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoError("Masukkan kode promo"); return; }
    if (cart.length === 0) { setPromoError("Keranjang kosong"); return; }
    setPromoError(null);
    if (code === "CONTOH10") {
      const disc = Math.min(Math.round(subtotal * 0.1), 50000);
      if (disc <= 0) { setPromoError("Subtotal terlalu kecil"); return; }
      setPromoDisc(disc); setPromoCode(code); haptic(30); toast.success(`Promo ${code} diterapkan: -${formatCurrencyPlain(disc)}`);
    } else if (code === "HEMAT20K") {
      const disc = Math.min(20000, subtotal);
      setPromoDisc(disc); setPromoCode(code); haptic(30); toast.success(`Promo ${code} diterapkan: -${formatCurrencyPlain(disc)}`);
    } else {
      setPromoError("Kode tidak valid. Coba CONTOH10 atau HEMAT20K (mock)");
      haptic([20, 30, 20]);
    }
  };
  const clearPromo = () => { setPromoDisc(0); setPromoCode(""); setPromoError(null); haptic(15); };

  useEffect(() => {
    if (cart.length === 0 && promoDisc > 0) { setPromoDisc(0); setPromoError(null); }
    if (promoDisc > subtotal) setPromoDisc(subtotal);
  }, [cart.length, subtotal, promoDisc]);

  const handleCheckout = async () => {
    let finalCustomerId = customerId;
    if (showNameField) {
      if (!newCustomerName.trim()) { toast.error("Nama customer wajib untuk tambah baru"); return; }
      if (!customerPhone.trim()) { toast.error("Telepon wajib"); return; }
      setSaving(true);
      try {
        await createCustomer({ name: newCustomerName.trim(), phone: customerPhone.trim() });
        const found = await searchCustomersByPhone(customerPhone);
        const norm = customerPhone.replace(/\D/g, ""); let phoneNorm = norm; if (phoneNorm.startsWith("0")) phoneNorm = "62" + phoneNorm.slice(1);
        const match = found.find((c: any) => c.phone === phoneNorm) ?? found[0];
        if (!match?.id) throw new Error("Gagal membuat customer");
        finalCustomerId = match.id;
        setCId(finalCustomerId);
        setShowNameField(false);
        setNewCustomerName("");
        toast.success(`Customer ${match.name} dibuat`);
      } catch (e: any) { toast.error(e?.message ?? "Gagal buat customer"); setSaving(false); return; } finally { setSaving(false); }
    }
    if (!finalCustomerId) { toast.error("Customer wajib — cari no HP atau tambah baru"); return; }
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    for (const c of cart) {
      if (c.product.is_serialized && !c.imei1?.trim()) { toast.error(`IMEI wajib untuk ${c.product.name}`); return; }
      if (c.product.is_serialized && !/^\d{15}$/.test(c.imei1!.trim())) { toast.error(`IMEI ${c.product.name} harus 15 digit`); return; }
    }
    const paid = total;
    const kas_date = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      const res = await createSale({ customerId: finalCustomerId!, items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty, unit_price: c.unit_price, imei1: c.imei1, imei2: c.imei2, warna: c.warna })), payment_method: metode, kas_date, paid, notes: undefined, promoCode: promoDisc > 0 ? promoCode : null, discount_total: promoDisc });
      haptic([50, 30, 80]); toast.success(`Penjualan ${res.sale_number} berhasil`); setCart([]); setNewCustomerName(""); setShowNameField(false); setPromoDisc(0); setPromoCode(""); setPromoError(null); onSuccess();
    } catch (e: any) { toast.error(e?.message ?? "Gagal checkout"); } finally { setSaving(false); }
  };

  const setPhone = customerPhoneSetter ?? (() => {});
  const setCId = customerIdSetter ?? (() => {});

  return (
    <CardFrame data-cart-panel className="flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] w-full overflow-hidden lg:h-full lg:max-h-full">
      <CardFrameHeader>
        <CardFrameTitle>Keranjang</CardFrameTitle>
        <CardFrameAction>
          {cart.length > 0 ? (
            <Badge variant="secondary" size="sm" className="font-mono tabular-nums">{cart.length} item</Badge>
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <ScanIcon className="size-4" />
            </span>
          )}
        </CardFrameAction>
      </CardFrameHeader>

      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none before:hidden">
        <CardPanel className="flex-1 overflow-y-auto space-y-4 flex flex-col min-h-0">
          <div className="rounded-xl border bg-muted/20 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Customer</span>
              <Badge variant="outline" size="sm" className="font-mono text-[10px]">Wajib</Badge>
              {customerId && <span className="ml-auto text-xs text-emerald-600">✓ {customerPhone}</span>}
            </div>
            <div className="relative">
              <Input
                placeholder="Cari no HP — ketik 08..."
                value={customerPhone}
                onChange={(e) => {
                  const v = e.target.value;
                  setPhone(v);
                  if (customerId) setCId(null);
                  if (showNameField && v.trim().replace(/\D/g, "").length < 3) { setShowNameField(false); setNewCustomerName(""); }
                }}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setTimeout(() => setPhoneFocused(false), 200)}
                className="pr-8"
              />
              {phoneFocused && (phoneResults.length > 0 || customerPhone.trim().replace(/\D/g, "").length >= 7) && (
                <div className="absolute z-20 mt-1.5 w-full rounded-lg border bg-popover shadow-lg p-1 max-h-48 overflow-auto">
                  {phoneSearching ? (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">Mencari...</div>
                  ) : phoneResults.length > 0 ? (
                    <>
                      {phoneResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPhone(c.phoneDisplay);
                            setCId(c.id);
                            setShowNameField(false);
                            setPhoneResults([]);
                            setPhoneFocused(false);
                            haptic(20);
                            toast.success(`Customer ${c.name} dipilih`);
                          }}
                          className="w-full text-left rounded-md px-2.5 py-2 hover:bg-accent flex flex-col gap-0.5"
                        >
                          <span className="font-medium text-sm">{c.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{c.phoneDisplay}</span>
                        </button>
                      ))}
                      {customerPhone.trim().replace(/\D/g, "").length >= 7 && !phoneResults.some((r: any) => r.phone === customerPhone.replace(/\D/g, "").replace(/^0/, "62")) && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setShowNameField(true);
                            setPhoneFocused(false);
                            haptic(20);
                          }}
                          className="w-full text-left rounded-md px-2.5 py-2 hover:bg-accent border-t mt-1 flex flex-col gap-0.5"
                        >
                          <span className="font-medium text-sm flex items-center gap-1">+ Tambah baru: {customerPhone.trim()}</span>
                          <span className="text-xs text-muted-foreground">Buat customer baru — akan minta nama di bawah</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowNameField(true);
                        setPhoneFocused(false);
                        haptic(20);
                      }}
                      className="w-full text-left rounded-md px-2.5 py-2 hover:bg-accent flex flex-col gap-0.5"
                    >
                      <span className="font-medium text-sm flex items-center gap-1">+ Tambah baru: {customerPhone.trim()}</span>
                      <span className="text-xs text-muted-foreground">Tidak ditemukan — buat customer baru</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {showNameField ? (
              <div className="space-y-1.5 animate-in fade-in">
                <Label className="text-xs">Nama customer *</Label>
                <Input
                  placeholder="Rina Hartati"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newCustomerName.trim()) { (document.activeElement as HTMLElement)?.blur(); } }}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">Wajib — akan dibuat saat Bayar & Cetak (tunda).</p>
              </div>
            ) : customerId ? (
              <div className="text-xs text-emerald-600">✓ Terpilih — siap checkout</div>
            ) : null}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[140px]">

          {cart.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>Keranjang kosong</EmptyTitle>
                <EmptyDescription>Klik produk di grid untuk menambah ke keranjang. Haptic akan bergetar saat item masuk.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.product.id} className="group relative flex gap-3 rounded-xl border bg-card p-3 shadow-xs/5 hover:bg-muted/20 transition-colors">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                    <PackageIcon className="size-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm leading-tight">{c.product.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground truncate">{c.product.sku} · {c.product.category} {c.product.is_serialized && <Badge variant="outline" size="sm" className="ml-1">IMEI</Badge>}</div>
                      </div>
                      <Button size="icon-sm" variant="ghost" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" onClick={() => { haptic([15, 30, 15]); setCart((prev) => prev.filter((x) => x.product.id !== c.product.id)); }}><TrashIcon className="size-3.5" /></Button>
                    </div>
                    {c.product.is_serialized && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <Input placeholder="IMEI 1 (15 digit)" value={c.imei1 ?? ""} onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, imei1: e.target.value } : x))} className="h-7 text-xs font-mono" />
                        <Input placeholder="Warna" value={c.warna ?? ""} onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, warna: e.target.value } : x))} className="h-7 text-xs" />
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 rounded-full border bg-background p-0.5">
                        <Button size="icon-sm" variant="ghost" className="size-6 rounded-full" onClick={() => setQty(c.product.id, c.qty - 1)}><MinusIcon className="size-3" /></Button>
                        <span className="w-6 text-center font-mono text-xs font-medium">{c.qty}</span>
                        <Button size="icon-sm" variant="ghost" className="size-6 rounded-full" onClick={() => setQty(c.product.id, c.qty + 1)}><PlusIcon className="size-3" /></Button>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold tabular-nums">{formatCurrencyPlain(c.qty * c.unit_price)}</div>
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-[10px] text-muted-foreground">Rp {c.unit_price.toLocaleString("id-ID")}/pcs</span>
                          <button type="button" onClick={() => { const v = prompt("Edit harga per pcs", String(c.unit_price)); if (v !== null) setUnitPrice(c.product.id, Number(v.replace(/[^\d]/g, "")) || 0); }} className="font-mono text-[10px] text-primary hover:underline">edit</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
                </div>
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Metode Pembayaran</span>
                  <Badge variant="outline" size="sm" className="font-mono text-[10px]">Wajib</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {METODE_META.map((m) => {
                    const Icon = m.icon;
                    const selected = metode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => { setMetode(m.value); haptic(15); }}
                        className={"flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors " + (selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/20")}
                      >
                        <span className={"flex size-8 items-center justify-center rounded-lg border shrink-0 " + (selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30")}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-sm leading-none">{m.value}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">{m.desc}</span>
                        </span>
                        {selected && <CheckCircle2Icon className="size-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Kode Promo</Label>
                <div className="flex gap-2">
                  <Input placeholder="CONTOH10 / HEMAT20K" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="flex-1 font-mono uppercase h-8 text-sm" />
                  <Button size="sm" variant="outline" onClick={applyPromo} disabled={!promoCode.trim() || promoDisc > 0}>Terapkan</Button>
                  {promoDisc > 0 && <Button size="sm" variant="ghost" onClick={clearPromo}>Hapus</Button>}
                </div>
                {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                {promoDisc > 0 && <p className="text-xs text-emerald-600">✓ Diskon {formatCurrencyPlain(promoDisc)} — {promoCode} (stack)</p>}
              </div>
            </>
          )}
        </CardPanel>

        {cart.length > 0 && (
          <div className="border-t bg-card p-3 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{formatCurrencyPlain(subtotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Diskon {promoCode ? `· ${promoCode}` : "Promo"}</span><span className="font-mono tabular-nums text-emerald-600">- {formatCurrencyPlain(promoDisc)}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between items-center"><span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span><span className="font-mono text-base font-bold tabular-nums">{formatCurrencyPlain(total)}</span></div>
          </div>
        )}

        <div className="border-t bg-muted/20 p-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { haptic(20); setCart([]); clearPromo(); }} disabled={saving || cart.length === 0}>Kosongkan</Button>
          <Button onClick={handleCheckout} disabled={saving || cart.length === 0} loading={saving}>Bayar & Cetak</Button>
        </div>
      </Card>
    </CardFrame>
  );
}
