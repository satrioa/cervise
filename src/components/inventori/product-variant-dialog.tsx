"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon, PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { createProduct, searchProductsForSale } from "@/app/app/penjualan/actions";
import { useBranch } from "@/lib/branch-context";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
};

const STORAGE_OPTIONS = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const WARNA_OPTIONS = ["Black", "White", "Silver", "Gold", "Blue", "Red", "Green", "Purple", "Titanium"];
const CATEGORY_OPTIONS = ["Gadget", "Aksesori", "Lainnya"];

export function ProductVariantDialog({ open, onOpenChange, onSuccess }: Props) {
  const { branch } = useBranch();
  const [variantType, setVariantType] = useState<"BARU" | "BEKAS">("BARU");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Gadget");
  const [storage, setStorage] = useState("64 GB");
  const [warna, setWarna] = useState("Black");
  const [stockQty, setStockQty] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  // Bekas specific
  const [imei, setImei] = useState("");
  const [bh, setBh] = useState("");
  const [kondisi, setKondisi] = useState("");
  const [garansiOn, setGaransiOn] = useState(false);
  const [garansiDays, setGaransiDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    if (!open) return;
    // reset on open
    setName("");
    setVariantType("BARU");
    setStorage("64 GB");
    setWarna("Black");
    setStockQty("");
    setCost("");
    setPrice("");
    setBarcode("");
    setImei("");
    setBh("");
    setKondisi("");
    setGaransiOn(false);
    setGaransiDays("30");
  }, [open]);

  // autocomplete for name
  useEffect(() => {
    if (!name.trim() || name.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await searchProductsForSale(name.trim());
        const names = [...new Set(rows.map((r) => r.name))].slice(0, 5);
        setSuggestions(names.filter((n) => n.toLowerCase() !== name.trim().toLowerCase()));
        setShowSuggest(names.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [name]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (!storage) { toast.error("Storage wajib"); return; }
    if (!warna) { toast.error("Warna wajib"); return; }
    if (!cost || Number(cost) < 0) { toast.error("Harga modal wajib"); return; }
    if (!price || Number(price) < 0) { toast.error("Harga jual wajib"); return; }
    if (variantType === "BARU") {
      if (!stockQty || Number(stockQty) < 0) { toast.error("Stok wajib >=0"); return; }
    } else {
      if (!imei.trim() || !/^\d{15}$/.test(imei.trim())) { toast.error("IMEI 15 digit wajib untuk Bekas"); return; }
      if (!bh || Number(bh) < 0 || Number(bh) > 100) { toast.error("BH 0-100 wajib"); return; }
      if (garansiOn && (!garansiDays || Number(garansiDays) <= 0)) { toast.error("Durasi garansi wajib >0"); return; }
    }
    setSaving(true);
    try {
      await createProduct({
        name: name.trim(),
        category,
        stock_qty: variantType === "BARU" ? Number(stockQty || 0) : undefined,
        cost: Number(cost),
        price: Number(price),
        barcode: barcode.trim() || undefined,
        variant_type: variantType,
        storage,
        warna,
        bh_percent: variantType === "BEKAS" ? Number(bh) : null,
        kondisi_notes: variantType === "BEKAS" ? kondisi.trim() || null : null,
        garansi_days: variantType === "BEKAS" && garansiOn ? Number(garansiDays) : null,
        imei: variantType === "BEKAS" ? imei.trim() : null,
      } as any);
      toast.success(`${variantType === "BARU" ? "Varian Baru" : "Unit Bekas"} ditambahkan — ${name} ${storage} ${warna}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal simpan");
    } finally { setSaving(false); }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-0 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                <PackageIcon className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">Tambah Produk — {branch.label}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {variantType === "BARU" ? "Varian Baru: warna+storage, stok agregat" : "Unit Bekas: per IMEI, BH, kondisi, garansi"}
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Tipe</span>
              <div className="flex rounded-lg border p-1 gap-1">
                <button type="button" onClick={() => setVariantType("BARU")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${variantType === "BARU" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Baru</button>
                <button type="button" onClick={() => setVariantType("BEKAS")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${variantType === "BEKAS" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Bekas</button>
              </div>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{variantType === "BARU" ? "Stok agregat" : "Stok 1 • IMEI"}</span>
            </div>

            <div className="space-y-1.5 relative">
              <Label>Nama produk *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => suggestions.length && setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} placeholder="iPhone 14 Pro, Samsung A54..." />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg p-1">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); setName(s); setShowSuggest(false); }} className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent">{s}</button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Ketik nama existing untuk reuse parent_key (group), atau nama baru untuk buat grup baru.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Kategori *</Label><Select value={category} onValueChange={(v) => setCategory((v as string) ?? "Gadget")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Gadget">Gadget</SelectItem><SelectItem value="Aksesori">Aksesori</SelectItem><SelectItem value="Lainnya">Lainnya</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Storage *</Label><Select value={storage} onValueChange={(v) => setStorage((v as string) ?? "64 GB")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STORAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="space-y-1.5"><Label>Warna *</Label><Select value={warna} onValueChange={(v) => setWarna((v as string) ?? "Black")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WARNA_OPTIONS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent></Select></div>

            {variantType === "BARU" ? (
              <div className="space-y-1.5"><Label>Stok qty *</Label><Input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="8" /></div>
            ) : (
              <>
                <div className="space-y-1.5"><Label>IMEI * (15 digit)</Label><Input value={imei} onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="356938035412345" inputMode="numeric" maxLength={15} /></div>
                <div className="space-y-1.5"><Label>BH % *</Label><Input type="number" min={0} max={100} value={bh} onChange={(e) => setBh(e.target.value)} placeholder="80" /></div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Harga Modal *</Label><Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="15500000" /></div>
              <div className="space-y-1.5"><Label>Harga Jual *</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="17900000" /></div>
            </div>

            <div className="space-y-1.5"><Label>Barcode (opsional)</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan / ketik SKU" /></div>

            {variantType === "BEKAS" && (
              <>
                <div className="space-y-1.5"><Label>Kondisi fisik notes</Label><Textarea value={kondisi} onChange={(e) => setKondisi(e.target.value)} placeholder="Lecet halus di bezel, BH 80%..." rows={2} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">Garansi</div>
                    <div className="text-xs text-muted-foreground">Jika ON, wajib isi durasi hari</div>
                  </div>
                  <Switch checked={garansiOn} onCheckedChange={setGaransiOn} />
                </div>
                {garansiOn && <div className="space-y-1.5"><Label>Durasi garansi (hari) *</Label><Input type="number" min={1} value={garansiDays} onChange={(e) => setGaransiDays(e.target.value)} placeholder="30" /></div>}
              </>
            )}

            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {variantType === "BARU" ? "SKU auto: GD-B-64-BK • stok agregat dikurangi per qty saat jual" : "SKU auto: GD-BK-64-...IMEI • stok 1→0 per IMEI saat jual • IMEI unik per cabang"}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving} loading={saving}>{variantType === "BARU" ? "Simpan Varian Baru" : "Simpan Unit Bekas"}</Button>
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
