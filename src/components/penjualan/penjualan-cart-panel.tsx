"use client";

import { useMemo, useState } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import { MinusIcon, PlusIcon, TrashIcon, PackageIcon, ScanIcon, FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameDescription,
  CardFrameAction,
  CardPanel,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { haptic } from "@/lib/haptic";
import { createSale, type ProductRow } from "@/app/app/penjualan/actions";

const METODE = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"] as const;
type CartItem = { product: ProductRow; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string };

export function PenjualanCartPanel({ branchLabel, onSuccess, customerId, customerPhone, customerPhoneSetter, customerIdSetter }: { branchLabel: string; onSuccess: () => void; customerId: string | null; customerPhone: string; customerPhoneSetter?: (v: string) => void; customerIdSetter?: (v: string | null) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metode, setMetode] = useState<string>("Tunai");
  const [saving, setSaving] = useState(false);
  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.qty * c.unit_price, 0), [cart]);

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

  const handleCheckout = async () => {
    if (!customerId) { toast.error("Customer wajib — pilih customer dulu"); return; }
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    for (const c of cart) {
      if (c.product.is_serialized && !c.imei1?.trim()) { toast.error(`IMEI wajib untuk ${c.product.name}`); return; }
      if (c.product.is_serialized && !/^\d{15}$/.test(c.imei1!.trim())) { toast.error(`IMEI ${c.product.name} harus 15 digit`); return; }
    }
    const paid = subtotal;
    const kas_date = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      const res = await createSale({ customerId: customerId!, items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty, unit_price: c.unit_price, imei1: c.imei1, imei2: c.imei2, warna: c.warna })), payment_method: metode, kas_date, paid, notes: undefined });
      haptic([50, 30, 80]); toast.success(`Penjualan ${res.sale_number} berhasil`); setCart([]); onSuccess();
    } catch (e: any) { toast.error(e?.message ?? "Gagal checkout"); } finally { setSaving(false); }
  };

  const setPhone = customerPhoneSetter ?? (() => {});
  const setCId = customerIdSetter ?? (() => {});

  return (
    <CardFrame data-cart-panel className="flex flex-col h-[calc(100dvh-135px)] max-h-[calc(100dvh-135px)] w-full overflow-hidden">
      <CardFrameHeader>
        <CardFrameTitle>Keranjang</CardFrameTitle>
        <CardFrameDescription>
          {branchLabel} · {cart.length > 0 ? `${cart.length} item · ${formatCurrencyPlain(subtotal)}` : "Kelola penjualan POS"}
        </CardFrameDescription>
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
        <CardPanel className="flex-1 overflow-y-auto space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3 flex flex-col gap-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.3em]">Customer (wajib)</Label>
            <div className="flex gap-2">
              <Input placeholder="HP — scan / ketik" value={customerPhone} onChange={(e) => setPhone(e.target.value)} className="flex-1" onBlur={async () => {
                const phone = customerPhone.trim(); if (!phone) return;
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                const { data } = await supabase.from("cervise_customers").select("id").ilike("phone", `%${phone}%`).limit(1).maybeSingle();
                if (data) setCId((data as any).id);
              }} />
              <Button size="filter" variant="outline" onClick={async () => {
                const phone = customerPhone.trim(); if (!phone) { toast.error("HP wajib"); return; }
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                const { data } = await supabase.from("cervise_customers").select("id").ilike("phone", `%${phone}%`).limit(1).maybeSingle();
                if (data) { setCId((data as any).id); toast.success("Customer ditemukan"); }
                else toast.error("Customer tidak ditemukan — buat di Customer dulu");
              }}>Cari</Button>
            </div>
            {customerId && <div className="text-xs text-emerald-600">✓ {customerId.slice(0, 8)} · {customerPhone}</div>}
          </div>

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

          {cart.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-[0.3em]">Pembayaran</Label>
                <Select value={metode} onValueChange={(v) => setMetode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METODE.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Langsung lunas — pembayaran saat checkout. Tanggal otomatis hari ini.</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
                <span className="font-mono text-base font-bold tabular-nums">{formatCurrencyPlain(subtotal)}</span>
              </div>
            </>
          )}
        </CardPanel>

        <div className="border-t bg-muted/20 p-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { haptic(20); setCart([]); }} disabled={saving || cart.length === 0}>Kosongkan</Button>
          <Button onClick={handleCheckout} disabled={saving || cart.length === 0} loading={saving}>Bayar & Cetak</Button>
        </div>
      </Card>
    </CardFrame>
  );
}
