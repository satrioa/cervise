"use client";

import { useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PenjualanTable } from "@/components/penjualan/penjualan-table";
import { PenjualanCartDialog } from "@/components/penjualan/penjualan-cart-dialog";
import { ProductVariantDialog } from "@/components/inventori/product-variant-dialog";
import { useBranch } from "@/lib/branch-context";
import { getSaleDetail, returnSaleItems } from "./actions";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function PenjualanClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const { branch } = useBranch();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [returOpen, setReturOpen] = useState(false);
  const [returSale, setReturSale] = useState<any>(null);
  const [returItems, setReturItems] = useState<any[]>([]);
  const [prodOpen, setProdOpen] = useState(false);

  const handleDetail = async (id: string) => {
    try { const d = await getSaleDetail(id); setDetail(d); setDetailOpen(true); } catch (e: any) { toast.error(e.message); }
  };

  const handlePrint = async (id: string) => {
    try {
      const d = await getSaleDetail(id);
      const itemsHtml = d.items.map((it: any, i: number) => `<tr><td>${i + 1}</td><td>${it.sku}</td><td>${it.name}</td><td>${it.qty}</td><td>${formatCurrencyPlain(Number(it.unit_price))}</td><td>${formatCurrencyPlain(Number(it.line_total))}</td></tr>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${d.sale.sale_number}</title><style>body{font-family:system-ui;padding:32px}table{width:100%;border-collapse:collapse}th{background:#111827;color:#fff;padding:8px}td{padding:8px;border-bottom:1px solid #eee} .mono{font-family:monospace}</style></head><body><h1>Cervise — Nota ${d.sale.sale_number}</h1><p>${d.sale.kas_date} · ${branch.label} · ${d.customer?.name ?? ""}</p><table><thead><tr><th>No</th><th>SKU</th><th>Nama</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table><p class="mono">Total ${formatCurrencyPlain(Number(d.sale.total))} · ${d.sale.payment_method}</p><script>window.print()</script></body></html>`;
      const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReturOpen = async (id: string) => {
    try {
      const d = await getSaleDetail(id);
      if (d.sale.status === "retur") { toast.info("Sudah retur"); return; }
      setReturSale(d.sale); setReturItems(d.items.map((it: any) => ({ ...it, returQty: 0 }))); setReturOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRetur = async () => {
    const rets = returItems.filter((it) => it.returQty > 0).map((it) => ({ item_id: it.id, qty: it.returQty }));
    if (!rets.length) { toast.error("Pilih qty retur"); return; }
    try { await returnSaleItems(returSale.id, rets); toast.success("Retur berhasil"); setReturOpen(false); router.refresh(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" size="filter" onClick={() => setProdOpen(true)}>Tambah Produk</Button>
        <Button onClick={() => setOpen(true)} size="filter">Transaksi Baru</Button>
      </div>
      <PenjualanTable rows={initialRows} onDetail={handleDetail} onPrint={handlePrint} onRetur={handleReturOpen} />
      <PenjualanCartDialog open={open} onOpenChange={setOpen} branchLabel={branch.label} onSuccess={() => router.refresh()} />

      <DialogPrimitive.Root open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg max-h-[85vh] overflow-auto">
            <DialogPrimitive.Title className="font-semibold">Nota {detail?.sale?.sale_number}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">{detail?.customer?.name} · {detail?.sale?.kas_date} · {detail?.sale?.payment_method}</DialogPrimitive.Description>
            {detail && (
              <div className="mt-4 space-y-2 text-sm">
                {detail.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between border-b py-2">
                    <div><div className="font-medium">{it.name}</div><div className="font-mono text-xs text-muted-foreground">{it.sku} · qty {it.qty} {it.qty_returned > 0 && `(retur ${it.qty_returned})`} {it.is_serialized && `· IMEI ${it.item_meta?.imei1 ?? ""}`}</div></div>
                    <div className="font-mono">{formatCurrencyPlain(Number(it.line_total))}</div>
                  </div>
                ))}
                <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">{formatCurrencyPlain(Number(detail.sale.total))}</span></div>
                <div className="text-xs text-muted-foreground">Voucher per nota segera hadir — diskon per item sudah di unit_price.</div>
              </div>
            )}
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">×</DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={returOpen} onOpenChange={setReturOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Retur Parsial — {returSale?.sale_number}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Pilih qty retur per SKU (parsial didukung).</DialogPrimitive.Description>
            <div className="mt-4 space-y-2 max-h-64 overflow-auto">
              {returItems.map((it) => (
                <div key={it.id} className="flex items-center gap-2 border rounded-lg p-2">
                  <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{it.name}</div><div className="font-mono text-xs text-muted-foreground">{it.sku} · qty {it.qty} (retur {it.qty_returned})</div></div>
                  <div className="flex items-center gap-1">
                    <Label className="font-mono text-[10px]">Retur</Label>
                    <Input type="number" min={0} max={it.qty - it.qty_returned} value={it.returQty} onChange={(e) => setReturItems((prev) => prev.map((x) => x.id === it.id ? { ...x, returQty: Math.max(0, Math.min(Number(e.target.value), x.qty - x.qty_returned)) } : x))} className="h-7 w-16" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setReturOpen(false)}>Batal</Button><Button onClick={handleRetur}>Proses Retur</Button></div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">×</DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ProductVariantDialog open={prodOpen} onOpenChange={setProdOpen} onSuccess={() => router.refresh()} />
    </>
  );
}