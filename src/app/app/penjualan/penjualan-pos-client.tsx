"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { useRouter } from "next/navigation";
import { SearchIcon, History, LayoutGrid, List, PackageIcon, ScanLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useBranch } from "@/lib/branch-context";
import { searchProductsForSale, getSaleDetail, returnSaleItems, type ProductRow } from "./actions";
import { PenjualanProductGrid } from "@/components/penjualan/penjualan-product-grid";
import { PenjualanTable } from "@/components/penjualan/penjualan-table";
import { PenjualanCartPanel } from "@/components/penjualan/penjualan-cart-panel";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import JellyRadio from "@/components/ui/jelly-radio";
import { Card, CardPanel, CardFrame, CardFrameHeader, CardFrameTitle, CardFrameAction } from "@/components/ui/card";

const KATEGORI_ITEMS = [
  { value: "semua", label: "Semua" },
  { value: "Gadget", label: "Gadget" },
  { value: "Aksesori", label: "Aksesori" },
  { value: "Lainnya", label: "Lainnya" },
];
const STOK_ITEMS = [
  { value: "semua", label: "Semua stok" },
  { value: "habis", label: "Habis" },
  { value: "menipis", label: "Menipis" },
  { value: "tersedia", label: "Tersedia" },
];
const HARGA_ITEMS = [
  { value: "termurah", label: "Termurah" },
  { value: "termahal", label: "Termahal" },
];

export function PenjualanPOSClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const { branch } = useBranch();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [stockFilter, setStockFilter] = useState<string>("semua");
  const [sortHarga, setSortHarga] = useState<"termurah" | "termahal">("termurah");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [riwayatOpen, setRiwayatOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [returOpen, setReturOpen] = useState(false);
  const [returSale, setReturSale] = useState<any>(null);
  const [returItems, setReturItems] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await searchProductsForSale("");
        // An empty catalogue must stay empty: substituting placeholder products
        // here would let the cashier sell something that does not exist.
        if (!cancelled) {
          setProducts(rows);
          setProductsError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setProducts([]);
          setProductsError(cause instanceof Error ? cause.message : "Gagal memuat produk");
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branch.id]);

  const filteredProducts = useMemo(() => {
    let out = products.filter((p) => {
      if (q.trim()) {
        const hay = `${p.sku} ${p.name} ${p.barcode ?? ""}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      if (kategori !== "semua" && p.category !== kategori) return false;
      if (stockFilter === "habis" && p.stock_qty !== 0) return false;
      if (stockFilter === "menipis" && !(p.stock_qty > 0 && p.stock_qty < 10)) return false;
      if (stockFilter === "tersedia" && p.stock_qty < 10) return false;
      return true;
    });
    out = [...out].sort((a, b) => sortHarga === "termurah" ? a.price - b.price : b.price - a.price);
    return out;
  }, [products, q, kategori, stockFilter, sortHarga]);

  const handleDetail = async (id: string) => {
    try { const d = await getSaleDetail(id); setDetail(d); setDetailOpen(true); } catch (e: any) { toast.error(e.message); }
  };
  const handlePrint = async (id: string) => {
    try {
      const d = await getSaleDetail(id);
      const itemsHtml = d.items.map((it: any, i: number) => `<tr><td>${i + 1}</td><td>${it.sku}</td><td>${it.name}</td><td>${it.qty}</td><td>${formatCurrencyPlain(Number(it.unit_price))}</td><td>${formatCurrencyPlain(Number(it.line_total))}</td></tr>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${d.sale.sale_number}</title><style>body{font-family:system-ui;padding:32px}table{width:100%;border-collapse:collapse}th{background:#111827;color:#fff;padding:8px}td{padding:8px;border-bottom:1px solid #eee} .mono{font-family:monospace}</style></head><body><h1>Cervise — Nota ${d.sale.sale_number}</h1><p>${d.sale.kas_date} · ${branch.label} · ${d.customer?.name ?? ""}</p><table><thead><tr><th>No</th><th>SKU</th><th>Nama</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table><p class="mono">Total ${formatCurrencyPlain(Number(d.sale.total))}</p><script>window.print()</script></body></html>`;
      const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
    } catch (e: any) { toast.error(e.message); }
  };
  const handleReturOpen = async (id: string) => {
    try { const d = await getSaleDetail(id); if (d.sale.status === "retur") { toast.info("Sudah retur"); return; } setReturSale(d.sale); setReturItems(d.items.map((it: any) => ({ ...it, returQty: 0 }))); setReturOpen(true); } catch (e: any) { toast.error(e.message); }
  };
  const handleRetur = async () => {
    const rets = returItems.filter((it) => it.returQty > 0).map((it) => ({ item_id: it.id, qty: it.returQty }));
    if (!rets.length) { toast.error("Pilih qty retur"); return; }
    try { await returnSaleItems(returSale.id, rets); toast.success("Retur berhasil"); setReturOpen(false); router.refresh(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 lg:px-6 py-3 lg:h-dvh lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px] lg:items-stretch items-start overflow-hidden">
        <CardFrame className="min-w-0 flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] overflow-hidden lg:h-full lg:max-h-full">
          <CardFrameHeader className="grid-rows-1 py-3 px-4 gap-2">
            <CardFrameTitle className="text-[15px]">Produk</CardFrameTitle>
            <CardFrameAction className="flex items-center gap-2">
              <Popover open={riwayatOpen} onOpenChange={setRiwayatOpen}>
                <PopoverTrigger render={<Button variant="outline" size="sm"><History className="size-3.5" /> Riwayat</Button>} />
                <PopoverContent align="end" className="w-[560px] max-w-[95vw] p-0">
                  <div className="max-h-[60vh] overflow-auto p-2">
                    <PenjualanTable rows={initialRows} onDetail={(id) => { setRiwayatOpen(false); handleDetail(id); }} onPrint={(id) => { setRiwayatOpen(false); handlePrint(id); }} onRetur={(id) => { setRiwayatOpen(false); handleReturOpen(id); }} />
                  </div>
                </PopoverContent>
              </Popover>
              <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "list")}>
                <TabsList className="h-7">
                  <TabsTrigger value="grid" aria-label="Grid view" className="h-6 px-2"><LayoutGrid className="size-3.5" /></TabsTrigger>
                  <TabsTrigger value="list" aria-label="List view" className="h-6 px-2"><List className="size-3.5" /></TabsTrigger>
                </TabsList>
              </Tabs>
            </CardFrameAction>
          </CardFrameHeader>
          <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
            <CardPanel className="flex-none px-3 py-2 border-b flex flex-col gap-1.5">
              <InputGroup className="w-full">
                <InputGroupAddon><SearchIcon className="size-3.5 text-muted-foreground" /></InputGroupAddon>
                <InputGroupInput placeholder="Scan barcode / SKU / nama + Enter" value={q} onChange={(e) => setQ(e.target.value)} nativeInput onKeyDown={(e) => { if (e.key === "Enter") { const term = q.trim(); if (term) { const hit = filteredProducts.find((p) => p.sku.toLowerCase() === term.toLowerCase() || (p.barcode && p.barcode.toLowerCase() === term.toLowerCase())); if (hit && (window as any).__penjualanAddToCart) (window as any).__penjualanAddToCart(hit); } } }} className="text-sm h-8" />
                <InputGroupAddon align="inline-end" className="gap-1 pr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    aria-label="Scan barcode"
                    onClick={() => {
                      // focus search for scanner device (hardware scanner types into input)
                      document.querySelector<HTMLInputElement>('[placeholder="Scan barcode / SKU / nama + Enter"]')?.focus();
                    }}
                  >
                    <ScanLineIcon className="size-4" />
                  </Button>
                </InputGroupAddon>
              </InputGroup>

              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto scrollbar-none">
                <JellyRadio items={KATEGORI_ITEMS} value={kategori} onChange={(v: string) => setKategori(v)} chipColor="#e4e4e7" activeColor="#18181b" textColor="#18181b" activeTextColor="#f5f5f5" size="sm" gap={3} radius={12} className="flex-1 min-w-[180px]" />
                <Select value={stockFilter} onValueChange={(v) => setStockFilter((v as string) ?? "semua")}>
                  <SelectTrigger size="sm" className="w-32 h-7 text-xs">
                    <SelectValue>{STOK_ITEMS.find((x) => x.value === stockFilter)?.label ?? "Semua stok"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STOK_ITEMS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortHarga} onValueChange={(v) => setSortHarga((v as any) ?? "termurah")}>
                  <SelectTrigger size="sm" className="w-28 h-7 text-xs">
                    <SelectValue>{HARGA_ITEMS.find((x) => x.value === sortHarga)?.label ?? "Termurah"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {HARGA_ITEMS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardPanel>
            <CardPanel className="flex-1 overflow-y-auto p-2.5 bg-muted/20 min-h-0">
              {productsError ? (
                <div role="alert" className="m-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {productsError}
                </div>
              ) : productsLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Memuat produk…</div>
              ) : products.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-1 px-4 text-center">
                  <p className="text-sm font-medium">Belum ada produk untuk dijual</p>
                  <p className="text-sm text-muted-foreground">Tambahkan produk di halaman Inventori terlebih dahulu.</p>
                </div>
              ) : view === "grid" ? (
                <PenjualanProductGrid products={filteredProducts} onAdd={(p) => { if ((window as any).__penjualanAddToCart) (window as any).__penjualanAddToCart(p); else toast.info("Klik keranjang kanan"); }} />
              ) : (
                <div className="rounded-xl border overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Varian</TableHead>
                        <TableHead>Stok</TableHead>
                        <TableHead className="text-right">Harga Jual</TableHead>
                        <TableHead className="w-px" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Tidak ada produk yang cocok dengan filter</TableCell></TableRow>
                      ) : (
                        filteredProducts.map((p) => {
                          const isBekas = (p as any).variant_type === "BEKAS";
                          return (
                            <TableRow key={p.id} className={p.stock_qty === 0 ? "opacity-60" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${isBekas ? "bg-amber-500/15 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                                    <PackageIcon className={`size-4 ${isBekas ? "text-amber-600" : "text-emerald-600/70"}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm truncate flex items-center gap-1.5">{p.name} <Badge variant="secondary" size="sm" className="font-mono text-[10px]">{isBekas ? "Bekas" : "Baru"}</Badge></div>
                                    <div className="font-mono text-xs text-muted-foreground truncate">{p.sku} {p.barcode ? `· ${p.barcode}` : ""} {isBekas && (p as any).imei ? `· ${String((p as any).imei).slice(-4)}` : ""}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-xs">
                                  <div>{(p as any).storage ?? "-"} • {(p as any).warna ?? "-"}</div>
                                  {isBekas && <div className="text-[11px] text-amber-700">BH {(p as any).bh_percent ?? "-"}% {(p as any).garansi_days ? `· Garansi ${(p as any).garansi_days}d` : ""}</div>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" size="sm" className={p.stock_qty === 0 ? "border-destructive/30 text-destructive" : p.stock_qty < 10 ? "border-amber-500/30 text-amber-700" : "border-emerald-500/30 text-emerald-700"}>{p.stock_qty} {p.stock_qty === 0 ? "Habis" : p.stock_qty < 10 ? "Menipis" : "Tersedia"}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">Rp {p.price.toLocaleString("id-ID")}</TableCell>
                              <TableCell><Button size="filter" variant="outline" disabled={p.stock_qty === 0} onClick={() => { if ((window as any).__penjualanAddToCart) (window as any).__penjualanAddToCart(p); }}>Tambah</Button></TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardPanel>
          </Card>
        </CardFrame>

        <div className="lg:sticky lg:top-6 flex flex-col lg:self-stretch min-h-0">
          <PenjualanCartPanel onSuccess={() => router.refresh()} customerId={customerId} customerPhone={customerPhone} customerPhoneSetter={setCustomerPhone} customerIdSetter={setCustomerId} />
          <div className="lg:hidden fixed bottom-[72px] left-1/2 z-30 -translate-x-1/2 w-[95vw] max-w-sm rounded-2xl border bg-background/95 backdrop-blur-xl p-3 shadow-2xl flex justify-between items-center lg:hidden">
            <span className="font-mono text-xs">Keranjang</span>
            <Button size="sm" onClick={() => document.querySelector<HTMLElement>("[data-cart-panel]")?.scrollIntoView({ behavior: "smooth" })}>Lihat Keranjang</Button>
          </div>
        </div>
      </div>

      <DialogPrimitive.Root open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg max-h-[85vh] overflow-auto">
            <DialogPrimitive.Title className="font-semibold">Nota {detail?.sale?.sale_number}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">{detail?.customer?.name} · {detail?.sale?.kas_date}</DialogPrimitive.Description>
            {detail && detail.items.map((it: any) => (<div key={it.id} className="flex justify-between border-b py-2 text-sm"><span>{it.name} ×{it.qty}</span><span className="font-mono">{formatCurrencyPlain(Number(it.line_total))}</span></div>))}
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">×</DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={returOpen} onOpenChange={setReturOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Retur Parsial — {returSale?.sale_number}</DialogPrimitive.Title>
            <div className="mt-4 space-y-2 max-h-64 overflow-auto">{returItems.map((it) => (<div key={it.id} className="flex items-center gap-2 border rounded-lg p-2"><div className="flex-1"><div className="font-medium text-sm">{it.name}</div><div className="font-mono text-xs">{it.sku} · qty {it.qty}</div></div><Input type="number" min={0} max={it.qty - it.qty_returned} value={it.returQty} onChange={(e) => setReturItems((prev) => prev.map((x) => x.id === it.id ? { ...x, returQty: Number(e.target.value) } : x))} className="h-7 w-16" /></div>))}</div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setReturOpen(false)}>Batal</Button><Button onClick={async () => { const rets = returItems.filter((it) => it.returQty > 0).map((it) => ({ item_id: it.id, qty: it.returQty })); if (!rets.length) return; await returnSaleItems(returSale.id, rets); toast.success("Retur berhasil"); setReturOpen(false); router.refresh(); }}>Proses Retur</Button></div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
