"use client";

import type { Dispatch, SetStateAction } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import { PackageIcon } from "lucide-react";
import { Button as CossButton } from "@/components/ui/coss-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardFrame, CardFrameHeader, CardFrameTitle, CardFrameAction, CardPanel } from "@/components/ui/card";
import type { PosCartItem, PosCustomer, PosNewCustomer } from "@/components/penjualan/pos-types";

/**
 * Tahap pembayaran, kolom kiri: isi pesanan tanpa kontrol ubah.
 *
 * Qty, harga, dan hapus item sengaja hilang di sini. IMEI tetap bisa diisi
 * karena wajib untuk unit serial dan baru diketahui saat menyerahkan barang.
 */
export function PenjualanOrderPanel({
  cart,
  setCart,
  customer,
  newCustomer,
  subtotal,
  onBack,
}: {
  cart: PosCartItem[];
  setCart: Dispatch<SetStateAction<PosCartItem[]>>;
  customer: PosCustomer | null;
  newCustomer: PosNewCustomer | null;
  subtotal: number;
  onBack: () => void;
}) {
  return (
    <CardFrame className="min-w-0 flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] overflow-hidden lg:h-full lg:max-h-full animate-in fade-in-0 slide-in-from-left-2 duration-300">
      <CardFrameHeader className="grid-rows-1 py-3 px-4 gap-2">
        <CardFrameTitle className="text-[15px]">Rincian Pesanan</CardFrameTitle>
        <CardFrameAction>
          <Badge variant="secondary" size="sm" className="font-mono tabular-nums">{cart.length} item</Badge>
        </CardFrameAction>
      </CardFrameHeader>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardPanel className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">Customer</div>
            <div className="font-medium">{customer?.name ?? newCustomer?.name?.trim() ?? "—"}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {customer?.phoneDisplay ?? newCustomer?.phone?.trim() ?? ""}
            </div>
          </div>

          {cart.map((c) => (
            <div key={c.product.id} className="flex gap-3 rounded-xl border bg-card p-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                <PackageIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm leading-tight">{c.product.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate">{c.product.sku} · {c.product.category}</div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
                    {formatCurrencyPlain(c.qty * c.unit_price)}
                  </div>
                </div>
                {c.product.is_serialized && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Input
                      placeholder="IMEI 1 (15 digit)"
                      value={c.imei1 ?? ""}
                      onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, imei1: e.target.value } : x))}
                      className="h-7 text-xs font-mono"
                    />
                    <Input
                      placeholder="Warna"
                      value={c.warna ?? ""}
                      onChange={(e) => setCart((prev) => prev.map((x) => x.product.id === c.product.id ? { ...x, warna: e.target.value } : x))}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.qty} × {formatCurrencyPlain(c.unit_price)}
                </div>
              </div>
            </div>
          ))}
        </CardPanel>

        <div className="border-t bg-card p-3">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{formatCurrencyPlain(subtotal)}</span></div>
        </div>

        <div className="border-t bg-muted/20 p-3 flex items-center gap-2">
          <CossButton variant="outline" className="flex-1" onClick={onBack}>Tambah Pesanan</CossButton>
        </div>
      </Card>
    </CardFrame>
  );
}
