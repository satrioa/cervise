"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import { useRouter } from "next/navigation";
import { SearchIcon, History, LayoutGrid, List, PackageIcon, BarcodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as CossButton } from "@/components/ui/coss-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranch } from "@/lib/branch-context";
import { searchProductsForSale, getSaleDetail, returnSaleItems, checkoutSale, type ProductRow, type ReceiptContext } from "./actions";
import { perkiraanRefund } from "@/lib/operational/retur";
import { buildSalesReceiptHtml, receiptStamp, type SalesReceiptInput } from "@/lib/sales/receipt";
import { printReceipt } from "@/lib/printer";
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { PenjualanProductGrid } from "@/components/penjualan/penjualan-product-grid";
import { PenjualanTable } from "@/components/penjualan/penjualan-table";
import { PenjualanCartPanel } from "@/components/penjualan/penjualan-cart-panel";
import { PenjualanOrderPanel } from "@/components/penjualan/penjualan-order-panel";
import { PenjualanPaymentPanel, type PaymentOutcome } from "@/components/penjualan/penjualan-payment-panel";
import { PenjualanReceiptDialog } from "@/components/penjualan/penjualan-receipt-dialog";
import { haptic } from "@/lib/haptic";
import type { PosCartItem, PosCustomer, PosNewCustomer } from "@/components/penjualan/pos-types";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ProductCardsSkeleton } from "@/components/ui/route-skeleton";
import { TableRowsSkeleton } from "@/components/ui/skeleton-shapes";
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

export function PenjualanPOSClient({ initialRows, receiptContext }: { initialRows: any[]; receiptContext: ReceiptContext }) {
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
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [stage, setStage] = useState<"cart" | "payment">("cart");
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [newCustomer, setNewCustomer] = useState<PosNewCustomer | null>(null);
  const [metode, setMetode] = useState("Tunai");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<{ input: SalesReceiptInput; subtitle: string } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [riwayatOpen, setRiwayatOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [returOpen, setReturOpen] = useState(false);
  const [returSale, setReturSale] = useState<any>(null);
  const [returItems, setReturItems] = useState<any[]>([]);
  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.qty * c.unit_price, 0), [cart]);

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

  const addToCart = (p: ProductRow) => {
    if (p.stock_qty <= 0) { toast.error(`${p.name} stok habis`); haptic([30, 50, 30]); return; }
    let didAdd = false;
    let isNew = false;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === p.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.qty + 1 > p.stock_qty) { toast.error("Melebihi stok"); haptic([20, 30, 20]); return prev; }
        const next = [...prev];
        next[idx] = { ...cur, qty: cur.qty + 1 };
        didAdd = true;
        return next;
      }
      didAdd = true;
      isNew = true;
      return [...prev, { product: p, qty: 1, unit_price: p.price }];
    });
    if (didAdd) haptic(isNew ? 50 : 20);
  };

  const imeiError = () => {
    for (const c of cart) {
      if (!c.product.is_serialized) continue;
      if (!c.imei1?.trim()) return `IMEI wajib untuk ${c.product.name}`;
      if (!/^\d{15}$/.test(c.imei1.trim())) return `IMEI ${c.product.name} harus 15 digit`;
    }
    return null;
  };

  const handleBayar = () => {
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    if (!customer && !(newCustomer?.name.trim() && newCustomer?.phone.trim())) {
      toast.error("Customer wajib — cari nama / nomor HP atau tambah customer baru");
      return;
    }
    const imei = imeiError();
    if (imei) { toast.error(imei); return; }
    haptic(20);
    setStage("payment");
  };

  const resetCheckout = () => {
    setCart([]);
    setCustomer(null);
    setNewCustomer(null);
    setMetode("Tunai");
    setStage("cart");
  };

  const handleSelesai = async (outcome: PaymentOutcome) => {
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    const imei = imeiError();
    if (imei) { toast.error(imei); return; }
    setSaving(true);
    const res = await checkoutSale({
      customerId: customer?.id ?? null,
      newCustomer: customer ? null : newCustomer,
      items: cart.map((c) => ({
        product_id: c.product.id,
        qty: c.qty,
        unit_price: c.unit_price,
        imei1: c.imei1,
        imei2: c.imei2,
        warna: c.warna,
      })),
      payment_method: metode,
      kas_date: kalenderWIB(),
      paid: outcome.paid,
      notes: outcome.notes,
      discount_total: 0,
      promoCode: null,
    });
    if (!res.ok) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    // Penjualan sudah tersimpan. Keranjang dikosongkan sekarang juga supaya
    // kasir tidak menekan Selesai dua kali kalau pengambilan nota gagal.
    resetCheckout();
    setSaving(false);
    haptic([50, 30, 80]);
    try {
      const detail = await getSaleDetail(res.saleId);
      setReceipt({
        input: {
          context: receiptContext,
          sale: detail.sale,
          customer: detail.customer,
          cashier: detail.cashier,
          items: detail.items,
        },
        subtitle: `${receiptStamp(detail.sale.created_at)} · ${res.saleNumber}`,
      });
      setReceiptOpen(true);
      router.refresh();
    } catch {
      toast.error(`Penjualan ${res.saleNumber} tersimpan, tetapi nota gagal dimuat. Cetak dari Riwayat.`);
    }
  };

  /**
   * Cetak langsung ke printer thermal; kalau browser tidak mendukung atau
   * printer gagal, `printReceipt` sendiri membuka dialog cetak sistem. Nota
   * tetap bisa dicetak, jadi kegagalan printer bukan jalan buntu.
   */
  const cetakNota = async (input: SalesReceiptInput) => {
    setPrinting(true);
    try {
      const result = await printReceipt({
        kind: "sale",
        html: buildSalesReceiptHtml(input),
        ...input,
      });
      if (result.fallback) {
        toast.info(result.error ? `${result.error} — membuka dialog cetak` : "Membuka dialog cetak");
      } else {
        toast.success("Nota dikirim ke printer");
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal mencetak nota");
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (receipt) await cetakNota(receipt.input);
  };

  const handleTutupReceipt = () => {
    setReceiptOpen(false);
    setReceipt(null);
  };

  const handleDetail = async (id: string) => {
    try { const d = await getSaleDetail(id); setDetail(d); setDetailOpen(true); } catch (e: any) { toast.error(e.message); }
  };
  const handlePrint = async (id: string) => {
    try {
      const d = await getSaleDetail(id);
      await cetakNota({
        context: receiptContext,
        sale: d.sale,
        customer: d.customer,
        cashier: d.cashier,
        items: d.items,
      });
    } catch (e: any) { toast.error(e.message); }
  };
  const handleReturOpen = async (id: string) => {
    try { const d = await getSaleDetail(id); if (d.sale.status === "retur") { toast.info("Sudah retur"); return; } setReturSale(d.sale); setReturItems(d.items.map((it: any) => ({ ...it, returQty: 0 }))); setReturOpen(true); } catch (e: any) { toast.error(e.message); }
  };
  const handleRetur = async () => {
    const rets = returItems.filter((it) => it.returQty > 0).map((it) => ({ item_id: it.id, qty: it.returQty }));
    if (!rets.length) { toast.error("Pilih qty retur"); return; }
    try {
      const result = await returnSaleItems(returSale.id, rets);
      // Nominal dari RPC, bukan dari perkiraan di layar - ini uang yang benar
      // benar keluar dari laci.
      toast.success(result.refund > 0 ? `Retur berhasil — uang kembali ${formatCurrencyPlain(result.refund)}` : "Retur berhasil — tanpa uang kembali");
      setReturOpen(false);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  // Perkiraan supaya kasir tahu nominal yang akan keluar sebelum menekan
  // tombol. Angka final tetap dari RPC - ini cermin rumusnya saja.
  const estimasiRefund = returSale
    ? perkiraanRefund(
        {
          subtotal: Number(returSale.subtotal ?? 0),
          total: Number(returSale.total ?? 0),
          paid: Number(returSale.paid ?? 0),
          returnedValue: Number(returSale.returned_value ?? 0),
        },
        returItems.map((it) => ({
          qty: Number(it.qty ?? 0),
          qtyReturned: Number(it.qty_returned ?? 0) + Math.max(0, Number(it.returQty) || 0),
          unitPrice: Number(it.unit_price ?? 0),
        })),
      )
    : 0;

  return (
    <>
      {/* Compact shell: akar mengisi sisa tinggi `main` supaya frame produk dan
          keranjang berhenti di atas bottom bar — tombol Bayar tidak perlu
          di-scroll. `lg:h-dvh` tetap dipakai AppShell (legacy), di sana
          `[data-main-content]` hanya `min-h-full` sehingga `h-full` = auto. */}
      <div className={`mx-auto grid max-w-[1600px] gap-4 px-4 lg:px-6 py-3 lg:h-dvh lg:grid-rows-[minmax(0,1fr)] lg:items-stretch items-start lg:overflow-hidden lg:group-data-[shell=compact]/shell:h-full transition-[grid-template-columns] duration-300 ease-out ${stage === "cart" ? "lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]" : "lg:grid-cols-[360px_1fr] xl:grid-cols-[380px_1fr]"}`}>
        {stage === "cart" ? (
        <CardFrame className="min-w-0 flex flex-col h-[calc(100dvh-96px)] max-h-[calc(100dvh-96px)] overflow-hidden lg:h-full lg:max-h-full animate-in fade-in-0 duration-200">
          <CardFrameHeader className="grid-rows-1 py-3 px-4 gap-2">
            <CardFrameTitle className="text-[15px]">Produk</CardFrameTitle>
            <CardFrameAction className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <InputGroup className="w-full">
                  <InputGroupAddon><SearchIcon className="size-3.5 text-muted-foreground" /></InputGroupAddon>
                  <InputGroupInput placeholder="Cari Produk" value={q} onChange={(e) => setQ(e.target.value)} nativeInput onKeyDown={(e) => { if (e.key === "Enter") { const term = q.trim(); if (term) { const hit = filteredProducts.find((p) => p.sku.toLowerCase() === term.toLowerCase() || (p.barcode && p.barcode.toLowerCase() === term.toLowerCase())); if (hit) addToCart(hit); } } }} className="text-sm h-8" />
                </InputGroup>
                <Button
                  type="button"
                  variant="candy"
                  color="green"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2.5"
                  aria-label="Scan barcode"
                  onClick={() => {
                    // focus search for scanner device (hardware scanner types into input)
                    document.querySelector<HTMLInputElement>('[placeholder="Cari Produk"]')?.focus();
                  }}
                >
                  <BarcodeIcon className="size-3.5 fill-current" />
                  Scan
                </Button>
              </div>

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
                view === "grid" ? (
                  // Bentuk grid produk: kartu dengan ikon besar + 2 baris teks
                  // dan baris harga/stok.
                  <ProductCardsSkeleton count={6} />
                ) : (
                  // Bentuk tabel produk: kolom produk (ikon + 2 baris), varian,
                  // stok (badge), harga, dan tombol tambah.
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
                        <TableRowsSkeleton
                          cells={["avatar", "text", "badge", "money", "icon"]}
                          rows={5}
                        />
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : products.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-1 px-4 text-center">
                  <p className="text-sm font-medium">Belum ada produk untuk dijual</p>
                  <p className="text-sm text-muted-foreground">Tambahkan produk di halaman Inventori terlebih dahulu.</p>
                </div>
              ) : view === "grid" ? (
                <PenjualanProductGrid products={filteredProducts} onAdd={addToCart} />
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
                              <TableCell><Button size="filter" variant="outline" disabled={p.stock_qty === 0} onClick={() => addToCart(p)}>Tambah</Button></TableCell>
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
        ) : (
          <PenjualanOrderPanel
            cart={cart}
            setCart={setCart}
            customer={customer}
            newCustomer={newCustomer}
            subtotal={subtotal}
            onBack={() => setStage("cart")}
          />
        )}

        <div className="lg:sticky lg:top-6 flex flex-col lg:self-stretch min-h-0">
          {stage === "cart" ? (
            <PenjualanCartPanel
              cart={cart}
              setCart={setCart}
              customer={customer}
              onSelectCustomer={setCustomer}
              newCustomer={newCustomer}
              onNewCustomerChange={setNewCustomer}
              subtotal={subtotal}
              onBayar={handleBayar}
              saving={saving}
              riwayatAction={
                <Popover open={riwayatOpen} onOpenChange={setRiwayatOpen}>
                  <PopoverTrigger render={<CossButton variant="outline" size="sm"><History className="size-3.5" /> Riwayat</CossButton>} />
                  <PopoverContent align="end" className="w-[560px] max-w-[95vw] p-0">
                    <div className="max-h-[60vh] overflow-auto p-2">
                      <PenjualanTable rows={initialRows} onDetail={(id) => { setRiwayatOpen(false); handleDetail(id); }} onPrint={(id) => { setRiwayatOpen(false); handlePrint(id); }} onRetur={(id) => { setRiwayatOpen(false); handleReturOpen(id); }} />
                    </div>
                  </PopoverContent>
                </Popover>
              }
            />
          ) : (
            <PenjualanPaymentPanel
              metode={metode}
              onMetodeChange={setMetode}
              subtotal={subtotal}
              total={subtotal}
              onSelesai={handleSelesai}
              saving={saving}
            />
          )}
          {stage === "cart" && (
            <div className="lg:hidden fixed bottom-[72px] left-1/2 z-30 -translate-x-1/2 w-[95vw] max-w-sm rounded-2xl border bg-background/95 backdrop-blur-xl p-3 shadow-2xl flex justify-between items-center lg:hidden">
              <span className="font-mono text-xs">Keranjang</span>
              <Button size="sm" onClick={() => document.querySelector<HTMLElement>("[data-cart-panel]")?.scrollIntoView({ behavior: "smooth" })}>Lihat Keranjang</Button>
            </div>
          )}
        </div>
      </div>

      <DialogPrimitive.Root open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg max-h-[85vh] overflow-auto">
            <DialogPrimitive.Title className="font-semibold">Nota {detail?.sale?.sale_number}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">{detail?.customer?.name} · {detail?.sale?.kas_date}</DialogPrimitive.Description>
            {detail && detail.items.map((it: any) => (<div key={it.id} className="flex justify-between border-b py-2 text-sm"><span>{it.name} ×{it.qty}{Number(it.qty_returned) > 0 ? ` · retur ${it.qty_returned}` : ""}</span><span className="font-mono">{formatCurrencyPlain(Number(it.line_total))}</span></div>))}
            {detail && Number(detail.sale.returned_value) > 0 ? (<div className="mt-2 flex justify-between text-sm font-medium"><span>Diretur</span><span className="font-mono">{formatCurrencyPlain(Number(detail.sale.returned_value))}</span></div>) : null}
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
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="text-muted-foreground">Uang kembali (perkiraan)</span><span className="font-mono tabular-nums font-medium">{formatCurrencyPlain(estimasiRefund)}</span></div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setReturOpen(false)}>Batal</Button><Button onClick={handleRetur}>Proses Retur</Button></div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <PenjualanReceiptDialog
        open={receiptOpen}
        html={receipt ? buildSalesReceiptHtml(receipt.input) : ""}
        subtitle={receipt?.subtitle ?? ""}
        printing={printing}
        onPrint={handlePrintReceipt}
        onClose={handleTutupReceipt}
      />
    </>
  );
}
