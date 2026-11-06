"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import Image from "next/image";
import { formatCurrencyPlain } from "@/lib/format";
import { MinusIcon, PlusIcon, TrashIcon, PackageIcon, XIcon } from "lucide-react";
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
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
  useExpandableScreen,
} from "@/components/ui/expandable-screen";
import { toast } from "sonner";
import { haptic } from "@/lib/haptic";
import { publicPhotoUrl } from "@/lib/photos";
import { productThumbnail } from "@/lib/product-thumbnail";
import { searchCustomersForPos } from "@/app/app/customer/actions";
import type { PosCartItem, PosCustomer, PosNewCustomer } from "@/components/penjualan/pos-types";

type CartPanelProps = {
  cart: PosCartItem[];
  setCart: Dispatch<SetStateAction<PosCartItem[]>>;
  customer: PosCustomer | null;
  onSelectCustomer: (customer: PosCustomer | null) => void;
  newCustomer: PosNewCustomer | null;
  onNewCustomerChange: (customer: PosNewCustomer | null) => void;
  subtotal: number;
  onBayar: () => void;
  saving: boolean;
  riwayatAction?: ReactNode;
};

function CartThumb({ item }: { item: PosCartItem }) {
  const [failed, setFailed] = useState(false);
  const src = publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", item.product.image_url);
  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
      <Image
        src={!failed && src ? src : productThumbnail({ variantType: item.product.variant_type })}
        alt={item.product.name}
        fill
        sizes="56px"
        unoptimized
        onError={() => setFailed(true)}
        className="object-contain p-1"
      />
    </div>
  );
}

/**
 * Isi keranjang dipakai dua tempat: panel desktop dan sheet mobile. Logika
 * customer, qty, harga, dan tombol bayar tidak boleh punya salinan kedua.
 */
function CartBody({
  cart,
  setCart,
  customer,
  onSelectCustomer,
  newCustomer,
  onNewCustomerChange,
  subtotal,
  onBayar,
  saving,
  payLabel = "Bayar",
}: Omit<CartPanelProps, "riwayatAction"> & { payLabel?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Dropdown hanya tampil untuk >= 2 karakter, jadi hasil lama tidak perlu
    // dibersihkan secara sinkron di sini.
    if (query.trim().length < 2) return;
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchCustomersForPos(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const setQty = (id: string, qty: number) => {
    haptic(15);
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty: Math.max(1, Math.min(qty, c.product.stock_qty)) } : c));
  };
  const setUnitPrice = (id: string, price: number) => setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, unit_price: Math.max(0, price) } : c));

  const startNewCustomer = () => {
    const digits = query.replace(/\D/g, "");
    onNewCustomerChange({ name: "", phone: digits.length >= 7 ? query.trim() : "" });
    setFocused(false);
    setResults([]);
    haptic(20);
  };

  const showDropdown = focused && !newCustomer && query.trim().length >= 2;

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-4 p-3 flex flex-col min-h-0">
        <div className="rounded-xl border bg-muted/20 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Customer</span>
            <Badge variant="outline" size="sm" className="font-mono text-[10px]">Wajib</Badge>
          </div>

          {newCustomer ? (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Customer baru</Label>
                <button type="button" onClick={() => onNewCustomerChange(null)} className="text-[11px] text-muted-foreground hover:underline">
                  Batal
                </button>
              </div>
              <Input
                placeholder="Nama customer"
                value={newCustomer.name}
                onChange={(e) => onNewCustomerChange({ ...newCustomer, name: e.target.value })}
                autoFocus
                className="h-8 text-sm"
              />
              <Input
                placeholder="Nomor HP — 08..."
                value={newCustomer.phone}
                onChange={(e) => onNewCustomerChange({ ...newCustomer, phone: e.target.value })}
                inputMode="tel"
                className="h-8 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Disimpan saat pembayaran selesai.</p>
            </div>
          ) : customer ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{customer.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{customer.phoneDisplay}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { onSelectCustomer(null); setQuery(""); }}>Ganti</Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Cari nama / nomor HP"
                value={query}
                onChange={(e) => { setQuery(e.target.value); onSelectCustomer(null); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
              />
              {showDropdown && (
                <div className="absolute z-20 mt-1.5 w-full rounded-lg border bg-popover shadow-lg p-1 max-h-56 overflow-auto">
                  {searching ? (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">Mencari...</div>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelectCustomer(c);
                          setQuery(c.phoneDisplay);
                          setResults([]);
                          setFocused(false);
                          haptic(20);
                        }}
                        className="w-full text-left rounded-md px-2.5 py-2 hover:bg-accent flex flex-col gap-0.5"
                      >
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{c.phoneDisplay}</span>
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startNewCustomer();
                    }}
                    className="w-full text-left rounded-md px-2.5 py-2 hover:bg-accent border-t mt-1 flex flex-col gap-0.5"
                  >
                    <span className="font-medium text-sm">+ Tambah customer baru</span>
                    <span className="text-xs text-muted-foreground">
                      {results.length === 0 ? "Tidak ditemukan — isi nama dan nomor HP" : `Tidak ada yang cocok dengan "${query.trim()}"`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
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
                  <EmptyDescription>Klik produk di grid untuk menambah ke keranjang.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div key={c.product.id} className="group relative flex gap-3 rounded-xl border bg-card p-3 shadow-xs/5 hover:bg-muted/20 transition-colors">
                    <CartThumb item={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-sm leading-tight">{c.product.name}</span>
                            <Badge variant="secondary" size="sm" className={`shrink-0 border-0 px-1 py-0 text-[9px] ${c.product.variant_type === "BEKAS" ? "bg-amber-500 text-white" : "bg-sky-500 text-white"}`}>
                              {c.product.variant_type === "BEKAS" ? "Bekas" : "Baru"}
                            </Badge>
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground truncate">
                            {c.product.sku}
                            {c.product.storage || c.product.warna ? ` · ${[c.product.storage, c.product.warna].filter(Boolean).join(" ")}` : ""}
                          </div>
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
      </div>

      {cart.length > 0 && (
        <div className="border-t bg-card p-3 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{formatCurrencyPlain(subtotal)}</span></div>
          <Separator className="my-1" />
          <div className="flex justify-between items-center"><span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span><span className="font-mono text-base font-bold tabular-nums">{formatCurrencyPlain(subtotal)}</span></div>
        </div>
      )}

      <div className="border-t bg-muted/20 p-3 flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Kosongkan keranjang"
          title="Kosongkan keranjang"
          onClick={() => { haptic(20); setCart([]); toast.success("Keranjang dikosongkan"); }}
          disabled={saving || cart.length === 0}
        >
          <TrashIcon className="size-4" />
        </Button>
        <Button className="flex-1" onClick={onBayar} disabled={saving || cart.length === 0} loading={saving}>{payLabel}</Button>
      </div>
    </>
  );
}

/**
 * Tahap keranjang desktop. Metode pembayaran sengaja belum ada di sini:
 * metode dan total baru muncul setelah kasir menekan Bayar.
 */
export function PenjualanCartPanel({
  riwayatAction,
  ...props
}: CartPanelProps) {
  return (
    <CardFrame data-cart-panel className="flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] w-full overflow-hidden lg:h-full lg:max-h-full animate-in fade-in-0 slide-in-from-right-2 duration-300">
      <CardFrameHeader>
        <CardFrameTitle>Keranjang</CardFrameTitle>
        <CardFrameAction className="flex items-center gap-2">
          {props.cart.length > 0 && (
            <Badge variant="secondary" size="sm" className="font-mono tabular-nums">{props.cart.length} item</Badge>
          )}
          {riwayatAction}
        </CardFrameAction>
      </CardFrameHeader>

      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none before:hidden">
        <CartBody {...props} />
      </Card>
    </CardFrame>
  );
}

/** Isi kartu expand: header + CartBody, ditutup lewat X atau Bayar. */
function ExpandedCart(props: Omit<CartPanelProps, "riwayatAction">) {
  const { collapse } = useExpandableScreen();
  return (
    <div className="flex h-[calc(100dvh-160px)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">Keranjang</h2>
          <div className="text-xs text-muted-foreground">Total {props.cart.length} item</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Tutup keranjang" onClick={collapse}>
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <CartBody {...props} payLabel="Bayar Sekarang" />
      </div>
    </div>
  );
}

/**
 * Dock keranjang mobile yang morph menjadi kartu penuh. Cult UI memakai satu
 * `layoutId` bersama: pill dock dan kartu expand adalah elemen yang sama saat
 * dianimasikan, jadi tingginya ikut membesar dari dock ke hampir satu layar.
 */
export function PenjualanCartExpander(props: Omit<CartPanelProps, "riwayatAction">) {
  return (
    /* Tanpa transform: `-translate-x-1/2` membuat containing block baru dan
       `fixed inset-0` milik kartu expand ikut mengecil seukuran dock. */
    <div className="fixed inset-x-0 bottom-[72px] z-30 mx-auto w-[95vw] max-w-sm lg:hidden">
      <ExpandableScreen
        layoutId="penjualan-cart-expander"
        triggerRadius="16px"
        contentRadius="24px"
        animationDuration={0.25}
        lockScroll={false}
      >
        <ExpandableScreenTrigger className="block w-full">
          <div className="flex w-full items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl">
            <div className="min-w-0 flex-1 px-2.5 py-1">
              <div className="text-[11px] text-muted-foreground">Total {props.cart.length} item</div>
              <div className="font-mono text-base font-semibold tabular-nums">
                {formatCurrencyPlain(props.subtotal)}
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                props.onBayar();
              }}
            >
              Checkout
            </Button>
          </div>
        </ExpandableScreenTrigger>

        <ExpandableScreenContent
          showCloseButton={false}
          overlayClassName="fixed inset-x-0 top-16 bottom-[72px]"
          className="overflow-hidden! bg-background p-0 text-foreground shadow-2xl"
        >
          <ExpandedCart {...props} />
        </ExpandableScreenContent>
      </ExpandableScreen>
    </div>
  );
}
