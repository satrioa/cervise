"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PlusIcon, Trash2Icon, XIcon, PackageIcon, ScanBarcodeIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { createProductAction, searchProductsForSale } from "@/app/app/penjualan/actions";
import { uploadProductPhoto } from "@/app/app/inventori/photo-actions";
import { ProductPhotoPicker } from "@/components/inventori/product-photo";
import { useBranch } from "@/lib/branch-context";
import { playPageTransition } from "@/components/layout/page-transition";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { productThumbnail } from "@/lib/product-thumbnail";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, formatBytes, validatePhotoFile } from "@/lib/photos";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onSuccess?: () => void };

const STORAGE_PRESETS = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const WARNA_SUGGESTIONS = ["Black", "White", "Silver", "Gold", "Blue", "Red", "Green", "Purple", "Titanium"];
const CATEGORY_OPTIONS = ["Gadget", "Aksesori", "Lainnya"];
const ACCEPT = ALLOWED_PHOTO_TYPES.join(",");

type AxisKey = "warna" | "storage" | "custom";
type Axis = { id: string; key: AxisKey; name: string; options: { id: string; value: string }[] };
type ComboRow = { key: string; warna: string | null; storage: string | null; label: string };
type ComboValue = { stock: string; cost: string; price: string; barcode: string };
type ExistingMap = Record<string, { id: string; sku: string }>;

function uid() { return Math.random().toString(36).slice(2, 10); }
function norm(v: string) { return v.trim().toLowerCase(); }
function comboKey(warna: string | null, storage: string | null) {
  return `${norm(warna ?? "")}__${norm(storage ?? "")}`;
}

function defaultAxes(): Axis[] {
  return [
    ensureTrailingEmpty({ id: uid(), key: "warna", name: "Warna", options: [] }),
    ensureTrailingEmpty({ id: uid(), key: "storage", name: "Storage", options: [] }),
  ];
}

function ensureTrailingEmpty(axis: Axis): Axis {
  const opts = [...axis.options];
  const last = opts[opts.length - 1];
  if (!last || last.value.trim() !== "") opts.push({ id: uid(), value: "" });
  // keep single empty at end
  while (opts.length > 1 && opts[opts.length - 2].value.trim() === "" && opts[opts.length - 1].value.trim() === "") {
    opts.splice(opts.length - 2, 1);
  }
  return { ...axis, options: opts };
}

function filledOptions(axis: Axis) { return axis.options.filter((o) => o.value.trim() !== ""); }

function buildCombos(axes: Axis[]): ComboRow[] {
  const filled = axes.map((a) => ({ ...a, filled: filledOptions(a) })).filter((a) => a.filled.length > 0);
  if (filled.length === 0) return [{ key: comboKey(null, null), warna: null, storage: null, label: "Default" }];
  const lists = filled.map((a) => a.filled.map((o) => ({ axisKey: a.key, axisName: a.name, value: o.value.trim() })));
  let acc: Array<Record<string, string>> = [{}];
  for (const list of lists) {
    const next: Array<Record<string, string>> = [];
    for (const base of acc) for (const item of list) next.push({ ...base, [item.axisKey]: item.value });
    acc = next;
  }
  return acc.map((rec) => {
    const warna = rec.warna ?? null;
    const storage = rec.storage ?? null;
    const label = [warna, storage].filter(Boolean).join(" / ") || "Default";
    return { key: comboKey(warna, storage), warna, storage, label };
  });
}

function PhotoPerWarna({
  file,
  onFile,
  disabled,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const prevRef = useRef<string | null>(null);
  useEffect(() => () => { if (prevRef.current) URL.revokeObjectURL(prevRef.current); }, []);
  useEffect(() => {
    if (!file) {
      if (prevRef.current) { URL.revokeObjectURL(prevRef.current); prevRef.current = null; }
      setPreview(null);
    }
  }, [file]);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 hover:bg-muted/50 disabled:opacity-50"
        title="Foto warna"
      >
        {preview ? (
          <Image src={preview} alt="" fill sizes="36px" unoptimized className="object-cover" />
        ) : (
          <Image src={productThumbnail({ variantType: "BARU" })} alt="" fill sizes="36px" unoptimized className="object-cover opacity-60" />
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const v = validatePhotoFile(f);
          if (!v.ok) { toast.error(v.error); return; }
          if (prevRef.current) URL.revokeObjectURL(prevRef.current);
          const url = URL.createObjectURL(f);
          prevRef.current = url;
          setPreview(url);
          onFile(f);
        }}
      />
      {file ? (
        <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onFile(null)} disabled={disabled}>hapus</button>
      ) : null}
    </div>
  );
}

export function ProductVariantDialog({ open, onOpenChange, onSuccess }: Props) {
  const { branch } = useBranch();
  const [variantType, setVariantType] = useState<"BARU" | "BEKAS">("BARU");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Gadget");
  // BEKAS (legacy single)
  const [bStorage, setBStorage] = useState("64 GB");
  const [bWarna, setBWarna] = useState("Black");
  const [bStockQty, setBStockQty] = useState("");
  const [bCost, setBCost] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bBarcode, setBBarcode] = useState("");
  const [bImei, setBImei] = useState("");
  const [bBh, setBBh] = useState("");
  const [bKondisi, setBKondisi] = useState("");
  const [bGaransiOn, setBGaransiOn] = useState(false);
  const [bGaransiDays, setBGaransiDays] = useState("30");
  const [bPhotoFile, setBPhotoFile] = useState<File | null>(null);
  // BARU variasi
  const [axes, setAxes] = useState<Axis[]>(() => [ensureTrailingEmpty({ id: uid(), key: "warna", name: "Warna", options: [] })]);
  const [comboValues, setComboValues] = useState<Record<string, ComboValue>>({});
  const [colorPhotos, setColorPhotos] = useState<Record<string, File | null>>({});
  const [bulk, setBulk] = useState({ stock: "", cost: "", price: "" });
  const [existing, setExisting] = useState<ExistingMap>({});
  const [existingLoadedFor, setExistingLoadedFor] = useState<string>("");
  // common
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<{ kind: "bekas" } | { kind: "combo"; key: string } | null>(null);
  const lastNameRef = useRef("");

  useEffect(() => {
    if (!open) return;
    setVariantType("BARU");
    setName(""); setCategory("Gadget");
    setBStorage("64 GB"); setBWarna("Black"); setBStockQty(""); setBCost(""); setBPrice(""); setBBarcode("");
    setBImei(""); setBBh(""); setBKondisi(""); setBGaransiOn(false); setBGaransiDays("30"); setBPhotoFile(null);
    setAxes(defaultAxes());
    setComboValues({}); setColorPhotos({}); setBulk({ stock: "", cost: "", price: "" });
    setExisting({}); setExistingLoadedFor("");
    setSaving(false); setSuggestions([]); setShowSuggest(false);
  }, [open]);

  // autocomplete name
  useEffect(() => {
    if (!name.trim() || name.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await searchProductsForSale(name.trim());
        const names = [...new Set(rows.map((r) => r.name))].slice(0, 6);
        setSuggestions(names.filter((n) => n.toLowerCase() !== name.trim().toLowerCase()));
        setShowSuggest(names.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [name]);

  // load existing variants when name matches exactly an existing group (reuse)
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) { setExisting({}); setExistingLoadedFor(""); return; }
    if (trimmed === existingLoadedFor) return;
    const t = setTimeout(async () => {
      try {
        const rows = await searchProductsForSale(trimmed);
        const exact = rows.filter((r) => r.name.toLowerCase() === trimmed.toLowerCase() && r.variant_type === "BARU");
        if (exact.length === 0) { if (existingLoadedFor) { setExisting({}); setExistingLoadedFor(""); } return; }
        const map: ExistingMap = {};
        for (const r of exact) {
          const k = comboKey((r as any).warna ?? null, (r as any).storage ?? null);
          if (!map[k]) map[k] = { id: r.id, sku: r.sku };
        }
        setExisting(map);
        setExistingLoadedFor(trimmed);
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [name, existingLoadedFor]);

  const combos = useMemo(() => buildCombos(axes), [axes]);
  const hasWarnaAxis = axes.some((a) => filledOptions(a).length > 0 && a.key === "warna");

  // preserve combo values when combos change
  useEffect(() => {
    setComboValues((prev: Record<string, ComboValue>) => {
      const next: Record<string, ComboValue> = {};
      for (const c of combos) next[c.key] = prev[c.key] ?? { stock: "", cost: "", price: "", barcode: "" };
      return next;
    });
  }, [combos]);

  const setAxisName = (id: string, v: string) => setAxes((prev: Axis[]) => prev.map((a) => a.id === id ? { ...a, name: v } : a));
  const setOption = (axisId: string, optId: string, value: string) => setAxes((prev: Axis[]) => prev.map((a) => {
    if (a.id !== axisId) return a;
    const opts = a.options.map((o) => o.id === optId ? { ...o, value } : o);
    return ensureTrailingEmpty({ ...a, options: opts });
  }));
  const removeOption = (axisId: string, optId: string) => setAxes((prev: Axis[]) => prev.map((a) => {
    if (a.id !== axisId) return a;
    const opts = a.options.filter((o) => o.id !== optId);
    return ensureTrailingEmpty({ ...a, options: opts.length ? opts : [{ id: uid(), value: "" }] });
  }));
  const addAxis = () => setAxes((prev: Axis[]) => {
    if (prev.length >= 2) return prev;
    return [...prev, ensureTrailingEmpty({ id: uid(), key: "storage", name: "Storage", options: [] })];
  });
  const removeAxis = (id: string) => setAxes((prev: Axis[]) => {
    const next = prev.filter((a) => a.id !== id);
    return next.length ? next : [ensureTrailingEmpty({ id: uid(), key: "warna", name: "Warna", options: [] })];
  });

  const applyBulk = () => {
    setComboValues((prev: Record<string, ComboValue>) => {
      const next = { ...prev };
      for (const c of combos) {
        if (existing[c.key]) continue;
        const cur = next[c.key] ?? { stock: "", cost: "", price: "", barcode: "" };
        next[c.key] = {
          stock: bulk.stock !== "" ? bulk.stock : cur.stock,
          cost: bulk.cost !== "" ? bulk.cost : cur.cost,
          price: bulk.price !== "" ? bulk.price : cur.price,
          barcode: cur.barcode,
        };
      }
      return next;
    });
  };

  const saveBekas = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (!bStorage) { toast.error("Storage wajib"); return; }
    if (!bWarna) { toast.error("Warna wajib"); return; }
    if (!bCost || Number(bCost) < 0) { toast.error("Harga modal wajib"); return; }
    if (!bPrice || Number(bPrice) < 0) { toast.error("Harga jual wajib"); return; }
    if (!bImei.trim() || !/^\d{15}$/.test(bImei.trim())) { toast.error("IMEI 15 digit wajib untuk Bekas"); return; }
    if (!bBh || Number(bBh) < 0 || Number(bBh) > 100) { toast.error("BH 0-100 wajib"); return; }
    if (bGaransiOn && (!bGaransiDays || Number(bGaransiDays) <= 0)) { toast.error("Durasi garansi wajib >0"); return; }
    setSaving(true);
    try {
      const res = await createProductAction({
        name: name.trim(), category,
        cost: Number(bCost), price: Number(bPrice),
        barcode: bBarcode.trim() || undefined,
        variant_type: "BEKAS", storage: bStorage, warna: bWarna,
        bh_percent: Number(bBh), kondisi_notes: bKondisi.trim() || null,
        garansi_days: bGaransiOn ? Number(bGaransiDays) : null, imei: bImei.trim(),
      } as any);
      if (!res.ok) { toast.error(res.error); return; }
      if (bPhotoFile) {
        try { const fd = new FormData(); fd.append("file", bPhotoFile); await uploadProductPhoto(res.id, fd); }
        catch (e) { toast.warning(`Produk tersimpan, foto gagal: ${e instanceof Error ? e.message : "coba lagi"}`); }
      }
      toast.success(`Unit Bekas ditambahkan — ${name} ${bStorage} ${bWarna}`);
      playPageTransition(); onOpenChange(false); onSuccess?.();
    } catch (e: any) { toast.error(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const saveBaru = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    const toCreate = combos.filter((c) => !existing[c.key]);
    if (toCreate.length === 0) { toast.error("Semua kombinasi sudah ada, tidak ada yang baru untuk disimpan"); return; }
    // validate
    for (const c of toCreate) {
      const v = comboValues[c.key];
      if (!c.warna) { toast.error("Warna wajib untuk setiap kombinasi (isi opsi Warna)"); return; }
      if (!c.storage) { toast.error("Storage wajib untuk setiap kombinasi (isi opsi Storage)"); return; }
      if (!v || v.stock === "" || Number(v.stock) < 0 || !Number.isInteger(Number(v.stock))) { toast.error(`Stok wajib (>=0, bilangan bulat) untuk ${c.label}`); return; }
      if (!v || v.cost === "" || Number(v.cost) < 0) { toast.error(`Harga modal wajib untuk ${c.label}`); return; }
      if (!v || v.price === "" || Number(v.price) < 0) { toast.error(`Harga jual wajib untuk ${c.label}`); return; }
    }
    setSaving(true);
    const created: { key: string; id: string; warna: string | null }[] = [];
    const errors: string[] = [];
    try {
      for (const c of toCreate) {
        const v = comboValues[c.key];
        const res = await createProductAction({
          name: name.trim(), category,
          stock_qty: Number(v.stock), cost: Number(v.cost), price: Number(v.price),
          barcode: v.barcode.trim() || undefined,
          variant_type: "BARU", storage: c.storage ?? undefined, warna: c.warna ?? undefined,
        } as any);
        if (!res.ok) errors.push(`${c.label}: ${res.error}`);
        else created.push({ key: c.key, id: res.id, warna: c.warna });
      }
      // upload photos per warna to each created row of that color
      for (const item of created) {
        const photo = item.warna ? colorPhotos[norm(item.warna)] : null;
        if (!photo) continue;
        try { const fd = new FormData(); fd.append("file", photo); await uploadProductPhoto(item.id, fd); }
        catch { /* foto gagal tidak menggagalkan produk */ }
      }
      if (errors.length && created.length) {
        toast.warning(`${created.length} varian tersimpan, ${errors.length} gagal: ${errors[0]}`);
        playPageTransition(); onSuccess?.();
      } else if (errors.length) {
        toast.error(errors[0]);
      } else {
        toast.success(`${created.length} varian ditambahkan — ${name.trim()}`);
        playPageTransition(); onOpenChange(false); onSuccess?.();
      }
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Gagal simpan");
    } finally { setSaving(false); }
  };

  const onSubmit = () => (variantType === "BEKAS" ? saveBekas() : saveBaru());
  const bulkReady = bulk.stock !== "" || bulk.cost !== "" || bulk.price !== "";

  const renderBekas = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Storage *</Label>
          <Select value={bStorage} onValueChange={(v) => setBStorage((v as string) ?? "64 GB")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STORAGE_PRESETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label>Warna *</Label>
          <Select value={bWarna} onValueChange={(v) => setBWarna((v as string) ?? "Black")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WARNA_SUGGESTIONS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label>IMEI * (15 digit)</Label><Input value={bImei} onChange={(e: ChangeEvent<HTMLInputElement>) => setBImei(e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="356938035412345" inputMode="numeric" maxLength={15} /></div>
      <div className="space-y-1.5"><Label>BH % *</Label><Input type="number" min={0} max={100} value={bBh} onChange={(e: ChangeEvent<HTMLInputElement>) => setBBh(e.target.value)} placeholder="80" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Harga Modal *</Label><Input type="number" min={0} value={bCost} onChange={(e: ChangeEvent<HTMLInputElement>) => setBCost(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Harga Jual *</Label><Input type="number" min={0} value={bPrice} onChange={(e: ChangeEvent<HTMLInputElement>) => setBPrice(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Barcode (opsional)</Label>
        <div className="flex gap-2">
          <Input value={bBarcode} onChange={(e: ChangeEvent<HTMLInputElement>) => setBBarcode(e.target.value)} placeholder="Scan / ketik SKU" />
          <Button type="button" variant="outline" size="icon" aria-label="Scan barcode" onClick={() => { setScanTarget({ kind: "bekas" }); setScanOpen(true); }} className="shrink-0"><ScanBarcodeIcon className="size-4" /></Button>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Foto produk (opsional)</Label><ProductPhotoPicker value={null} onFile={setBPhotoFile} disabled={saving} /></div>
      <div className="space-y-1.5"><Label>Kondisi fisik notes</Label><Textarea value={bKondisi} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBKondisi(e.target.value)} rows={2} /></div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div><div className="font-medium text-sm">Garansi</div><div className="text-xs text-muted-foreground">Jika ON, wajib isi durasi hari</div></div>
        <Switch checked={bGaransiOn} onCheckedChange={setBGaransiOn} />
      </div>
      {bGaransiOn && <div className="space-y-1.5"><Label>Durasi garansi (hari) *</Label><Input type="number" min={1} value={bGaransiDays} onChange={(e: ChangeEvent<HTMLInputElement>) => setBGaransiDays(e.target.value)} /></div>}
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">Unit Bekas: per IMEI, stok 1→0, BH/kondisi/garansi per unit (alur single-unit dipertahankan).</div>
    </div>
  );

  const renderBaru = () => (
    <div className="space-y-5">
      {/* Axes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Variasi <span className="text-destructive">*</span></Label>
          {axes.length < 2 && <Button type="button" variant="outline" size="sm" onClick={addAxis}><PlusIcon className="size-4" /> Tambah Variasi 2</Button>}
        </div>
        {axes.map((axis, idx) => (
          <div key={axis.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium w-16 shrink-0">Variasi {idx + 1}</span>
              <Input value={axis.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setAxisName(axis.id, e.target.value)} placeholder={idx === 0 ? "Warna" : "Storage"} className="h-8 max-w-[200px]" />
              <div className="ml-auto flex items-center gap-1">
                {axes.length > 1 && <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeAxis(axis.id)} aria-label="Hapus variasi"><Trash2Icon className="size-4" /></Button>}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Opsi {axis.name || `Variasi ${idx + 1}`} (isi untuk menambah, kosongkan untuk hapus)</div>
              <div className="flex flex-wrap gap-2">
                {axis.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-1">
                    <Input
                      value={opt.value}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setOption(axis.id, opt.id, e.target.value)}
                      placeholder={axis.key === "storage" ? "cth. 128 GB" : "cth. Black"}
                      className="h-8 w-36"
                      list={axis.key === "storage" ? `storage-suggest-${axis.id}` : axis.key === "warna" ? `warna-suggest-${axis.id}` : undefined}
                    />
                    {opt.value.trim() !== "" && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeOption(axis.id, opt.id)} aria-label="Hapus opsi"><XIcon className="size-3.5" /></Button>
                    )}
                  </div>
                ))}
              </div>
              {axis.key === "storage" && (
                <datalist id={`storage-suggest-${axis.id}`}>{STORAGE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
              )}
              {axis.key === "warna" && (
                <datalist id={`warna-suggest-${axis.id}`}>{WARNA_SUGGESTIONS.map((w) => <option key={w} value={w} />)}</datalist>
              )}
              {axis.key === "storage" && (
                <div className="flex flex-wrap gap-1 pt-1">{STORAGE_PRESETS.map((s) => (
                  <button key={s} type="button" className="rounded border px-2 py-0.5 text-[11px] hover:bg-accent" onClick={() => {
                    const empty = axis.options.find((o) => o.value.trim() === "");
                    if (empty) setOption(axis.id, empty.id, s); else setAxes((prev: Axis[]) => prev.map(a=>a.id===axis.id?ensureTrailingEmpty({...a, options:[...a.options,{id:uid(), value:s}]}):a));
                  }}>{s}</button>
                ))}</div>
              )}
            </div>
          </div>
        ))}
        {axes.every((a) => filledOptions(a).length === 0) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircleIcon className="size-3.5" /> Tanpa opsi = 1 varian default. Untuk HP, isi Warna & Storage.</p>
        )}
      </div>

      {/* Bulk apply */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium">Terapkan ke semua</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">Stok</Label><Input type="number" min={0} value={bulk.stock} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b: {stock:string;cost:string;price:string}) => ({ ...b, stock: e.target.value }))} className="h-8 w-28" /></div>
          <div className="space-y-1"><Label className="text-xs">Harga Modal</Label><Input type="number" min={0} value={bulk.cost} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b: {stock:string;cost:string;price:string}) => ({ ...b, cost: e.target.value }))} className="h-8 w-36" /></div>
          <div className="space-y-1"><Label className="text-xs">Harga Jual</Label><Input type="number" min={0} value={bulk.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b: {stock:string;cost:string;price:string}) => ({ ...b, price: e.target.value }))} className="h-8 w-36" /></div>
          <Button type="button" variant="secondary" size="sm" onClick={applyBulk} disabled={!bulkReady}>Terapkan Ke Semua</Button>
        </div>
      </div>

      {/* Combination table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Daftar Variasi <span className="text-destructive">*</span></Label>
          {existingLoadedFor && Object.keys(existing).length > 0 && <span className="text-xs text-muted-foreground">Varian grup &quot;{existingLoadedFor}&quot; terdeteksi (ditandai sudah ada)</span>}
        </div>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Kombinasi</th>
                {hasWarnaAxis && <th className="px-3 py-2 text-left font-medium">Foto Warna</th>}
                <th className="px-3 py-2 text-left font-medium">Stok *</th>
                <th className="px-3 py-2 text-left font-medium">Harga Modal *</th>
                <th className="px-3 py-2 text-left font-medium">Harga Jual *</th>
                <th className="px-3 py-2 text-left font-medium">Barcode/SKU</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {combos.map((c) => {
                const v = comboValues[c.key] ?? { stock: "", cost: "", price: "", barcode: "" };
                const ex = existing[c.key];
                const disabled = !!ex || saving;
                const warnaKey = c.warna ? norm(c.warna) : "";
                return (
                  <tr key={c.key} className={`border-t ${ex ? "bg-muted/30 text-muted-foreground" : ""}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{c.label}</td>
                    {hasWarnaAxis && (
                      <td className="px-3 py-2">
                        {c.warna ? (
                          <PhotoPerWarna file={colorPhotos[warnaKey] ?? null} onFile={(f) => setColorPhotos((p: Record<string, File | null>) => ({ ...p, [warnaKey]: f }))} disabled={saving} />
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                    )}
                    <td className="px-3 py-2"><Input type="number" min={0} value={v.stock} onChange={(e) => setComboValues((p: Record<string, ComboValue>) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), stock: e.target.value } }))} className="h-8 w-24" disabled={disabled} /></td>
                    <td className="px-3 py-2"><Input type="number" min={0} value={v.cost} onChange={(e) => setComboValues((p: Record<string, ComboValue>) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), cost: e.target.value } }))} className="h-8 w-32" disabled={disabled} /></td>
                    <td className="px-3 py-2"><Input type="number" min={0} value={v.price} onChange={(e) => setComboValues((p: Record<string, ComboValue>) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), price: e.target.value } }))} className="h-8 w-32" disabled={disabled} /></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Input value={v.barcode} onChange={(e) => setComboValues((p: Record<string, ComboValue>) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), barcode: e.target.value } }))} className="h-8 w-36" disabled={disabled} placeholder="opsional" />
                        <Button type="button" variant="outline" size="icon-sm" disabled={disabled} aria-label="Scan" onClick={() => { setScanTarget({ kind: "combo", key: c.key }); setScanOpen(true); }}><ScanBarcodeIcon className="size-3.5" /></Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{ex ? <span className="text-amber-600 font-medium">Sudah ada ({ex.sku})</span> : <span className="text-emerald-600">Baru</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">Setiap kombinasi baru disimpan sebagai varian BARU (stok agregat per warna+storage) dalam grup nama yang sama (parent_key). Kombinasi yang sudah ada dilewati.</p>
      </div>
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[96vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background p-0 shadow-2xl">
          <div className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background"><PackageIcon className="size-4" /></div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">Tambah Produk — {branch.label}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {variantType === "BARU" ? "Variasi Baru: atur Warna/Storage, tabel kombinasi, simpan banyak varian sekaligus." : "Unit Bekas: per IMEI, BH, kondisi, garansi (single unit)."}
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Tipe</span>
                <div className="flex gap-1 rounded-lg border p-1">
                  <button type="button" onClick={() => setVariantType("BARU")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variantType === "BARU" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Baru</button>
                  <button type="button" onClick={() => setVariantType("BEKAS")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variantType === "BEKAS" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Bekas</button>
                </div>
              </div>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{variantType === "BARU" ? "Variasi • stok agregat per kombinasi" : "Stok 1 • IMEI"}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative space-y-1.5">
                <Label>Nama produk *</Label>
                <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => { setName(e.target.value); setExistingLoadedFor(""); }} onFocus={() => suggestions.length && setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} placeholder="iPhone 14 Pro, Samsung A54..." />
                {showSuggest && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 shadow-lg">
                    {suggestions.map((s) => (
                      <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); setName(s); setExistingLoadedFor(""); setShowSuggest(false); }} className="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent">{s}</button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Nama existing = reuse grup (parent_key) & deteksi varian yang sudah ada.</p>
              </div>
              <div className="space-y-1.5"><Label>Kategori *</Label>
                <Select value={category} onValueChange={(v) => setCategory((v as string) ?? "Gadget")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>

            {variantType === "BEKAS" ? renderBekas() : renderBaru()}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving} loading={saving}>{variantType === "BARU" ? "Simpan Varian" : "Simpan Unit Bekas"}</Button>
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>

      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Scan barcode"
        description="Arahkan kamera ke barcode produk."
        onDetected={(value) => {
          if (scanTarget?.kind === "bekas") setBBarcode(value);
          else if (scanTarget?.kind === "combo") setComboValues((p: Record<string, ComboValue>) => ({ ...p, [scanTarget.key]: { ...(p[scanTarget.key] ?? { stock: "", cost: "", price: "", barcode: "" }), barcode: value } }));
          setScanTarget(null);
        }}
      />
    </DialogPrimitive.Root>
  );
}
