"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { SearchIcon, TrashIcon, PlusIcon, MinusIcon, ScanBarcodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { searchProductsForSale, createSale, type ProductRow } from "@/app/app/penjualan/actions";

const METODE = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"] as const;

type CartItem = { product: ProductRow; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string };

export function PenjualanCartDialog({ open, onOpenChange, branchLabel, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; branchLabel: string; onSuccess: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [metode, setMetode] = useState<string>("Tunai");
  const [kasDate, setKasDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.qty * c.unit_price, 0), [cart]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try { const rows = await searchProductsForSale(q); setResults(rows); } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const handleBarcode = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const term = q.trim();
    if (!term) return;
    const rows = await searchProductsForSale(term);
    if (rows.length === 1) {
      addToCart(rows[0]);
      setQ("");
    } else if (rows.length > 1) {
      setResults(rows);
      toast.info(`${rows.length} produk cocok — pilih dari list`);
    } else toast.error("SKU/Barcode tidak ditemukan");
  };

  const addToCart = (p: ProductRow) => {
    if (p.stock_qty <= 0) { toast.error(`${p.name} stok habis`); return; }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === p.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.qty + 1 > p.stock_qty) { toast.error("Melebihi stok"); return prev; }
        const next = [...prev]; next[idx] = { ...cur, qty: cur.qty + 1 }; return next;
      }
      return [...prev, { product: p, qty: 1, unit_price: p.price }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty: Math.max(1, Math.min(qty, c.product.stock_qty)) } : c));
  };

  const setUnitPrice = (id: string, price: number) => {
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, unit_price: Math.max(0, price) } : c));
  };

  const lookupCustomer = async () => {
    const phone = customerPhone.trim();
    if (!phone) return;
    const supabase = createClient();
    const { data } = await supabase.from("cervise_customers").select("id, name").ilike("phone", `%${phone}%`).limit(1).maybeSingle();
    if (data) { setCustomerId((data as any).id); setCustomerName((data as any).name); toast.success(`Customer ditemukan: ${(data as any).name}`); }
    else {
      // create inline
      const { data: branch } = await supabase.from("cervise_branches").select("id").limit(1).maybeSingle();
      if (!branch) { toast.error("Branch tidak ditemukan"); return; }
      // need branch_id from current user — fallback to first
      const { data: prof } = await supabase.auth.getUser();
      const { data: cp } = await supabase.from("cervise_profiles").select("branch_id").eq("id", prof.user!.id).maybeSingle();
      const branchId = (cp as any)?.branch_id ?? (branch as any).id;
      const { data: nc, error } = await supabase.from("cervise_customers").insert({ branch_id: branchId, name: customerName || phone, phone, tags: ["sales"] } as any).select("id").single();
      if (error) toast.error(error.message);
      else { setCustomerId((nc as any).id); toast.success("Customer baru dibuat"); }
    }
  };

  const handleCheckout = async () => {
    if (!customerId) { toast.error("Customer wajib — isi HP lalu Enter/Cari"); return; }
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    for (const c of cart) {
      if (c.product.is_serialized && !c.imei1?.trim()) { toast.error(`IMEI wajib untuk ${c.product.name}`); return; }
      if (c.product.is_serialized && !/^\d{15}$/.test(c.imei1!.trim())) { toast.error(`IMEI ${c.product.name} harus 15 digit`); return; }
      if (c.qty > c.product.stock_qty) { toast.error(`Stok ${c.product.name} tidak cukup`); return; }
    }
    const paidNum = paid.trim() === "" ? subtotal : Number(paid.replace(/[^\d]/g, ""));
    setSaving(true);
    try {
      const res = await createSale({
        customerId: customerId!,
        items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty, unit_price: c.unit_price, imei1: c.imei1, imei2: c.imei2, warna: c.warna })),
        payment_method: metode,
        kas_date: kasDate,
        paid: paidNum,
        notes,
      });
      toast.success(`Penjualan ${res.sale_number} berhasil`);
      setCart([]); setQ(""); setPaid(""); setNotes("");
      onOpenChange(false); onSuccess();
    } catch (e: any) { toast.error(e?.message ?? "Gagal checkout"); }
    finally { setSaving(false); }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
          <div className="shrink-0 border-b px-6 py-4">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold">Transaksi Baru — POS</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Scan barcode / SKU → cart → metode → checkout. Stok per cabang {branchLabel}.</DialogPrimitive.Description>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Customer wajib */}
            <div className="grid gap-2 rounded-xl border bg-card p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em]">Customer (wajib)</div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <div className="space-y-1.5"><Label>HP *</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookupCustomer()} placeholder="0812xxxx" /></div>
                <div className="space-y-1.5"><Label>Nama</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama customer" /></div>
                <Button size="filter" variant="outline" onClick={lookupCustomer} className="self-end">Cari/Buat</Button>
              </div>
              {customerId && <div className="text-xs text-emerald-600">✓ Customer terpilih {customerId.slice(0, 8)}</div>}
            </div>

            {/* Scan barcode */}
            <div className="space-y-2">
              <Label>Scan barcode / Cari SKU / Nama</Label>
              <InputGroup>
                <InputGroupAddon><ScanBarcodeIcon className="size-4 text-muted-foreground" /></InputGroupAddon>
                <InputGroupInput placeholder="SKU / barcode / nama + Enter" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleBarcode} nativeInput />
                <InputGroupAddon align="inline-end"><SearchIcon className="size-4 text-muted-foreground" /></InputGroupAddon>
              </InputGroup>
              {results.length > 0 && (
                <div className="rounded-lg border bg-card max-h-40 overflow-auto">
                  {results.map((p) => (
                    <button key={p.id} type="button" onClick={() => addToCart(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 text-left">
                      <div className="min-w-0"><div className="font-medium text-sm truncate">{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.sku} · {p.category} · {formatCurrencyPlain(p.price)} · stok {p.stock_qty}</div></div>
                      <Badge variant={p.stock_qty === 0 ? "destructive" : p.stock_qty < 5 ? "secondary" : "outline"} size="sm">{p.stock_qty === 0 ? "Habis" : `${p.stock_qty}`}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Qty</TableHead><TableHead>Harga</TableHead><TableHead>Subtotal</TableHead><TableHead className="w-px" /></TableRow></TableHeader>
                <TableBody>
                  {cart.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Keranjang kosong — scan barcode</TableCell></TableRow> : cart.map((c) => (
                    <TableRow key={c.product.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{c.product.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.product.sku} {c.product.is_serialized && <Badge variant="outline" size="sm">IMEI</Badge>}</div>
                        {c.product.is_serialized && (
                          <div className="mt-1 grid grid-cols-2 gap-1">
                            <Input placeholder="IMEI 1 (15 digit)" value={c.imei1 ?? ""} onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, imei1: e.target.value } : x))} className="h-7 text-xs" />
                            <Input placeholder="Warna" value={c.warna ?? ""} onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, warna: e.target.value } : x))} className="h-7 text-xs" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon-filter" variant="outline" onClick={() => setQty(c.product.id, c.qty - 1)}><MinusIcon /></Button>
                          <span className="w-6 text-center font-mono text-sm">{c.qty}</span>
                          <Button size="icon-filter" variant="outline" onClick={() => setQty(c.product.id, c.qty + 1)}><PlusIcon /></Button>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">stok {c.product.stock_qty}</div>
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={c.unit_price} onChange={(e) => setUnitPrice(c.product.id, Number(e.target.value))} className="h-7 w-24 font-mono text-xs" />
                        <div className="font-mono text-[10px] text-muted-foreground">modal {formatCurrencyPlain(c.product.cost)}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{formatCurrencyPlain((c.qty * c.unit_price))}</TableCell>
                      <TableCell><Button size="icon-filter" variant="ghost" onClick={() => setCart((prev) => prev.filter((x) => x.product.id !== c.product.id))}><TrashIcon /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between border-t bg-muted/20 px-4 py-3">
                <span className="font-mono text-xs">Subtotal</span>
                <span className="font-mono font-semibold tabular-nums">{formatCurrencyPlain(subtotal)}</span>
              </div>
            </div>

            {/* Metode & bayar */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Metode *</Label><Select value={metode} onValueChange={(v) => setMetode(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METODE.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Tanggal bayar *</Label><Input type="date" value={kasDate} onChange={(e) => setKasDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Bayar (kosong = lunas)</Label><Input placeholder={`${formatCurrencyPlain(subtotal)}`} value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Catatan nota, voucher per nota — soon" /></div>
            <div className="rounded border bg-amber-500/10 px-3 py-2 text-xs text-amber-700">Voucher per nota segera hadir — diskon sekarang per item via edit harga jual.</div>
          </div>

          <div className="flex justify-end gap-2 border-t p-4 bg-muted/20">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleCheckout} disabled={saving} loading={saving}>Bayar & Cetak</Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}