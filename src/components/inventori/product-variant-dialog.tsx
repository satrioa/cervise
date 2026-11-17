"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { AppImage } from "@/components/ui/app-image";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PlusIcon, Trash2Icon, XIcon, PackageIcon, ScanBarcodeIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { createProductAction, searchProductsForSale } from "@/app/app/penjualan/actions";
import { updateProductVariant } from "@/app/app/inventori/actions";
import { uploadProductPhoto } from "@/app/app/inventori/photo-actions";
import { ProductPhotoPicker } from "@/components/inventori/product-photo";
import { useBranch } from "@/lib/branch-context";
import { playPageTransition } from "@/components/layout/page-transition";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { productThumbnail } from "@/lib/product-thumbnail";
import { ALLOWED_PHOTO_TYPES, publicPhotoUrl, validatePhotoFile } from "@/lib/photos";
import { normalizeInventorySlug, type InventoryGroup, type InventoryProduct } from "@/lib/operational/inventori";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  editProduct?: InventoryProduct | null;
  editGroup?: { group: InventoryGroup; type: "BARU" | "BEKAS" } | null;
};

const STORAGE_PRESETS = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const WARNA_SUGGESTIONS = ["Black", "White", "Silver", "Gold", "Blue", "Red", "Green", "Purple", "Titanium"];
const CATEGORY_OPTIONS = ["Gadget", "Aksesori", "Lainnya"];
const ACCEPT = ALLOWED_PHOTO_TYPES.join(",");

type AxisKey = "warna" | "storage" | "custom";
type Axis = { id: string; key: AxisKey; name: string; options: { id: string; value: string }[] };
type ComboRow = { key: string; values: Record<string, string> }; // axisId -> value
type ComboValue = { stock: string; cost: string; price: string; barcode: string };
type BekasUnit = { id: string; productId?: string; imei: string; bh: string; cost: string; price: string; barcode: string; kondisi: string; garansiOn: boolean; garansiDays: string; photo: File | null };
type ExistingMap = Record<string, { id: string; sku: string }>;

function uid() { return Math.random().toString(36).slice(2, 10); }
function norm(v: string) { return v.trim().toLowerCase(); }

function ensureTrailingEmpty(axis: Axis): Axis {
  const opts = [...axis.options];
  const last = opts[opts.length - 1];
  if (!last || last.value.trim() !== "") opts.push({ id: uid(), value: "" });
  while (opts.length > 1 && opts[opts.length - 2].value.trim() === "" && opts[opts.length - 1].value.trim() === "") {
    opts.splice(opts.length - 2, 1);
  }
  return { ...axis, options: opts };
}

function filledOptions(axis: Axis) { return axis.options.filter((o) => o.value.trim() !== ""); }

function defaultAxes(): Axis[] {
  return [
    ensureTrailingEmpty({ id: uid(), key: "warna", name: "Warna", options: [] }),
    ensureTrailingEmpty({ id: uid(), key: "storage", name: "Storage", options: [] }),
  ];
}

function comboKeyFromAxes(activeAxes: Axis[], values: Record<string, string>) {
  return activeAxes.map((a) => `${a.id}:${norm(values[a.id] ?? "")}`).join("|");
}

function buildCombos(axes: Axis[]): { activeAxes: Axis[]; rows: ComboRow[] } {
  const activeAxes = axes.filter((a) => filledOptions(a).length > 0);
  if (activeAxes.length === 0) return { activeAxes, rows: [] };
  let acc: Array<Record<string, string>> = [{}];
  for (const axis of activeAxes) {
    const opts = filledOptions(axis);
    const next: Array<Record<string, string>> = [];
    for (const base of acc) for (const opt of opts) next.push({ ...base, [axis.id]: opt.value.trim() });
    acc = next;
  }
  const rows = acc.map((values) => ({ key: comboKeyFromAxes(activeAxes, values), values }));
  return { activeAxes, rows };
}

function comboLookupKey(warna: string | null, storage: string | null) {
  return `${norm(warna ?? "")}__${norm(storage ?? "")}`;
}

function newBekasUnit(): BekasUnit {
  return { id: uid(), imei: "", bh: "", cost: "", price: "", barcode: "", kondisi: "", garansiOn: false, garansiDays: "30", photo: null };
}

function PhotoPerWarna({ file, onFile, disabled }: { file: File | null; onFile: (f: File | null) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMeta, setCropMeta] = useState<{ name: string; type: string } | null>(null);
  const [cropSrcUrl, setCropSrcUrl] = useState<string | null>(null);

  const clearCrop = () => {
    if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl);
    setCropSrcUrl(null);
    setCropSrc(null);
    setCropMeta(null);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const v = validatePhotoFile(f);
    if (!v.ok) { toast.error(v.error); return; }
    clearCrop();
    const url = URL.createObjectURL(f);
    setCropSrcUrl(url);
    setCropSrc(url);
    setCropMeta({ name: f.name, type: f.type });
    setCropOpen(true);
  };

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl);
  }, [objectUrl, cropSrcUrl]);

  useEffect(() => {
    if (!file && objectUrl) { URL.revokeObjectURL(objectUrl); setObjectUrl(null); setPreview(null); }
  }, [file, objectUrl]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 hover:bg-muted/50">
          {preview ? (
            <AppImage src={preview} alt="" fill sizes="36px" unoptimized className="object-cover" preset="product" />
          ) : (
            <AppImage src={productThumbnail({ variantType: "BARU" })} alt="" fill sizes="36px" unoptimized className="object-cover opacity-60" preset="product" />
          )}
          <input type="file" accept={ACCEPT} className="hidden" disabled={disabled} onChange={pick} />
        </label>
        {file ? <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onFile(null)} disabled={disabled}>hapus</button> : null}
      </div>
      <ImageCropDialog
        open={cropOpen}
        src={cropSrc}
        aspect={1}
        title="Potong foto produk"
        description="Sesuaikan area persegi (1:1)."
        fileName={cropMeta?.name}
        mimeType={cropMeta?.type}
        onOpenChange={(next) => {
          if (!next) { setCropOpen(false); clearCrop(); }
        }}
        onComplete={(f) => {
          setCropOpen(false);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          const url = URL.createObjectURL(f);
          setObjectUrl(url);
          setPreview(url);
          onFile(f);
          clearCrop();
        }}
      />
    </>
  );
}

export function ProductVariantDialog({ open, onOpenChange, onSuccess, editProduct, editGroup }: Props) {
  const { branch } = useBranch();
  const isGroupEdit = Boolean(editGroup);
  const isEdit = Boolean(editProduct || editGroup);
  const existingPhotoUrl = useMemo(
    () => (editProduct?.image_url ? publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", editProduct.image_url) : null),
    [editProduct?.image_url],
  );
  const [variantType, setVariantType] = useState<"BARU" | "BEKAS">("BARU");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Gadget");

  // BEKAS single (variasi off)
  const [bStorage, setBStorage] = useState("64 GB");
  const [bWarna, setBWarna] = useState("Black");
  const [bCost, setBCost] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bBarcode, setBBarcode] = useState("");
  const [bImei, setBImei] = useState("");
  const [bBh, setBBh] = useState("");
  const [bKondisi, setBKondisi] = useState("");
  const [bGaransiOn, setBGaransiOn] = useState(false);
  const [bGaransiDays, setBGaransiDays] = useState("30");
  const [bPhotoFile, setBPhotoFile] = useState<File | null>(null);

  // BEKAS variasi (Opsi A: multi-unit per combo)
  const [bekasUnitsByCombo, setBekasUnitsByCombo] = useState<Record<string, BekasUnit[]>>({});
  const [bekasBulk, setBekasBulk] = useState({ cost: "", price: "", bh: "", garansiDays: "" });

  // BARU single (variasi off)
  const [sStorage, setSStorage] = useState("64 GB");
  const [sWarna, setSWarna] = useState("Black");
  const [sStock, setSStock] = useState("");
  const [sCost, setSCost] = useState("");
  const [sPrice, setSPrice] = useState("");
  const [sBarcode, setSBarcode] = useState("");
  const [sPhoto, setSPhoto] = useState<File | null>(null);

  // Variasi (shared axes for BARU/BEKAS)
  const [variasiOn, setVariasiOn] = useState(true);
  const [axes, setAxes] = useState<Axis[]>(() => defaultAxes());
  const [comboValues, setComboValues] = useState<Record<string, ComboValue>>({});
  const [colorPhotos, setColorPhotos] = useState<Record<string, File | null>>({});
  const [bulk, setBulk] = useState({ stock: "", cost: "", price: "" });
  const [existing, setExisting] = useState<ExistingMap>({});
  const [existingLoadedFor, setExistingLoadedFor] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<
    | { kind: "bekas-single" }
    | { kind: "baru-single" }
    | { kind: "baru-combo"; key: string }
    | { kind: "bekas-unit"; comboKey: string; unitId: string }
    | null
  >(null);

  useEffect(() => {
    if (!open) return;
    if (editGroup) {
      const { group, type } = editGroup;
      const items = (type === "BARU" ? group.baru : group.bekas).length > 0
        ? (type === "BARU" ? group.baru : group.bekas)
        : group.items;
      const first = items[0] ?? group.items[0];
      const uniq = (values: (string | null | undefined)[]) =>
        [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))];
      const nextAxes: Axis[] = [
        ensureTrailingEmpty({ id: uid(), key: "warna", name: "Warna", options: uniq(items.map((i) => i.warna)).map((value) => ({ id: uid(), value })) }),
        ensureTrailingEmpty({ id: uid(), key: "storage", name: "Storage", options: uniq(items.map((i) => i.storage)).map((value) => ({ id: uid(), value })) }),
      ];
      const warnaId = nextAxes[0].id;
      const storageId = nextAxes[1].id;
      const { rows: cs } = buildCombos(nextAxes);
      const cv: Record<string, ComboValue> = {};
      const bu: Record<string, BekasUnit[]> = {};
      const ex: ExistingMap = {};
      const matchOf = (warna: string, storage: string) => items.find(
        (i) => norm(i.warna ?? "") === norm(warna) && norm(i.storage ?? "") === norm(storage),
      );
      for (const c of cs) {
        const warna = c.values[warnaId] ?? "";
        const storage = c.values[storageId] ?? "";
        const match = matchOf(warna, storage);
        cv[c.key] = match
          ? { stock: String(match.stock_qty ?? 0), cost: String(match.cost ?? 0), price: String(match.price ?? 0), barcode: match.barcode ?? "" }
          : { stock: "", cost: "", price: "", barcode: "" };
        if (match) ex[comboLookupKey(warna, storage)] = { id: match.id, sku: match.sku };
        bu[c.key] = type === "BEKAS"
          ? items
              .filter((i) => norm(i.warna ?? "") === norm(warna) && norm(i.storage ?? "") === norm(storage))
              .map((i) => ({
                id: uid(), productId: i.id,
                imei: i.imei ?? "",
                bh: i.bh_percent == null ? "" : String(i.bh_percent),
                cost: String(i.cost ?? 0), price: String(i.price ?? 0), barcode: i.barcode ?? "",
                kondisi: i.kondisi_notes ?? "",
                garansiOn: (i.garansi_days ?? 0) > 0,
                garansiDays: i.garansi_days == null ? "30" : String(i.garansi_days),
                photo: null,
              }))
          : [];
      }
      const groupName = first?.name ?? group.name;
      setName(groupName);
      setCategory(first?.category ?? "Gadget");
      setVariantType(type);
      setVariasiOn(true);
      setAxes(nextAxes);
      setComboValues(cv);
      setBekasUnitsByCombo(bu);
      setExisting(ex);
      setExistingLoadedFor(groupName.trim());
      setColorPhotos({}); setBulk({ stock: "", cost: "", price: "" });
      setBekasBulk({ cost: "", price: "", bh: "", garansiDays: "" });
      setSaving(false); setSuggestions([]); setShowSuggest(false);
      return;
    }
    if (editProduct) {
      const isBekas = editProduct.variant_type === "BEKAS";
      setVariantType(isBekas ? "BEKAS" : "BARU");
      setName(editProduct.name ?? "");
      setCategory(editProduct.category ?? "Gadget");
      setVariasiOn(false);
      setAxes(defaultAxes());
      setComboValues({}); setColorPhotos({}); setBulk({ stock: "", cost: "", price: "" });
      setBekasUnitsByCombo({}); setBekasBulk({ cost: "", price: "", bh: "", garansiDays: "" });
      setExisting({}); setExistingLoadedFor("");
      setSaving(false); setSuggestions([]); setShowSuggest(false);
      if (isBekas) {
        setBStorage(editProduct.storage ?? "");
        setBWarna(editProduct.warna ?? "");
        setBCost(editProduct.cost == null ? "" : String(editProduct.cost));
        setBPrice(editProduct.price == null ? "" : String(editProduct.price));
        setBBarcode(editProduct.barcode ?? "");
        setBImei(editProduct.imei ?? "");
        setBBh(editProduct.bh_percent == null ? "" : String(editProduct.bh_percent));
        setBKondisi(editProduct.kondisi_notes ?? "");
        setBGaransiOn(editProduct.garansi_days != null && editProduct.garansi_days > 0);
        setBGaransiDays(editProduct.garansi_days == null ? "30" : String(editProduct.garansi_days));
        setBPhotoFile(null);
        setSStorage("64 GB"); setSWarna("Black"); setSStock(""); setSCost(""); setSPrice(""); setSBarcode(""); setSPhoto(null);
      } else {
        setSStorage(editProduct.storage ?? "");
        setSWarna(editProduct.warna ?? "");
        setSStock(editProduct.stock_qty == null ? "" : String(editProduct.stock_qty));
        setSCost(editProduct.cost == null ? "" : String(editProduct.cost));
        setSPrice(editProduct.price == null ? "" : String(editProduct.price));
        setSBarcode(editProduct.barcode ?? "");
        setSPhoto(null);
        setBStorage("64 GB"); setBWarna("Black"); setBCost(""); setBPrice(""); setBBarcode("");
        setBImei(""); setBBh(""); setBKondisi(""); setBGaransiOn(false); setBGaransiDays("30"); setBPhotoFile(null);
      }
      return;
    }
    setVariantType("BARU"); setName(""); setCategory("Gadget");
    setBStorage("64 GB"); setBWarna("Black"); setBCost(""); setBPrice(""); setBBarcode("");
    setBImei(""); setBBh(""); setBKondisi(""); setBGaransiOn(false); setBGaransiDays("30"); setBPhotoFile(null);
    setBekasUnitsByCombo({}); setBekasBulk({ cost: "", price: "", bh: "", garansiDays: "" });
    setSStorage("64 GB"); setSWarna("Black"); setSStock(""); setSCost(""); setSPrice(""); setSBarcode(""); setSPhoto(null);
    setVariasiOn(true); setAxes(defaultAxes());
    setComboValues({}); setColorPhotos({}); setBulk({ stock: "", cost: "", price: "" });
    setExisting({}); setExistingLoadedFor("");
    setSaving(false); setSuggestions([]); setShowSuggest(false);
  }, [open, editProduct, editGroup]);

  // reset variasi state when switching tipe to avoid cross-contamination
  useEffect(() => {
    if (isEdit) return;
    setVariasiOn(variantType === "BARU");
    setAxes(defaultAxes());
    setComboValues({}); setColorPhotos({}); setBulk({ stock: "", cost: "", price: "" });
    setBekasUnitsByCombo({}); setBekasBulk({ cost: "", price: "", bh: "", garansiDays: "" });
    setExisting({}); setExistingLoadedFor("");
  }, [variantType, isEdit]);

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

  useEffect(() => {
    if (isGroupEdit) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) { setExisting({}); setExistingLoadedFor(""); return; }
    if (trimmed === existingLoadedFor) return;
    if (variantType !== "BARU") { setExisting({}); setExistingLoadedFor(trimmed); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await searchProductsForSale(trimmed);
        const exact = rows.filter((r) => r.name.toLowerCase() === trimmed.toLowerCase() && r.variant_type === "BARU");
        if (exact.length === 0) { setExisting({}); setExistingLoadedFor(trimmed); return; }
        const map: ExistingMap = {};
        for (const r of exact) {
          const k = comboLookupKey((r as any).warna ?? null, (r as any).storage ?? null);
          if (!map[k]) map[k] = { id: r.id, sku: r.sku };
        }
        setExisting(map); setExistingLoadedFor(trimmed);
      } catch { setExisting({}); setExistingLoadedFor(trimmed); }
    }, 350);
    return () => clearTimeout(t);
  }, [name, existingLoadedFor, variantType, isGroupEdit]);

  const { activeAxes, rows: combos } = useMemo(() => buildCombos(axes), [axes]);
  const warnaAxis = activeAxes.find((a) => a.key === "warna") ?? null;
  const storageAxis = activeAxes.find((a) => a.key === "storage") ?? null;
  const duplicateAxisIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of axes) {
      const n = norm(a.name);
      if (!n) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const dup = new Set<string>();
    for (const a of axes) if ((counts.get(norm(a.name)) ?? 0) > 1 && norm(a.name)) dup.add(a.id);
    return dup;
  }, [axes]);

  useEffect(() => {
    setComboValues((prev) => {
      const next: Record<string, ComboValue> = {};
      for (const c of combos) next[c.key] = prev[c.key] ?? { stock: "", cost: "", price: "", barcode: "" };
      return next;
    });
  }, [combos]);

  useEffect(() => {
    setBekasUnitsByCombo((prev) => {
      const next: Record<string, BekasUnit[]> = {};
      for (const c of combos) next[c.key] = prev[c.key] ?? [];
      return next;
    });
  }, [combos]);

  const setAxisName = (id: string, v: string) => setAxes((prev) => prev.map((a) => a.id === id ? { ...a, name: v } : a));
  const setOption = (axisId: string, optId: string, value: string) => setAxes((prev) => prev.map((a) => {
    if (a.id !== axisId) return a;
    const opts = a.options.map((o) => o.id === optId ? { ...o, value } : o);
    return ensureTrailingEmpty({ ...a, options: opts });
  }));
  const removeOption = (axisId: string, optId: string) => setAxes((prev) => prev.map((a) => {
    if (a.id !== axisId) return a;
    const opts = a.options.filter((o) => o.id !== optId);
    return ensureTrailingEmpty({ ...a, options: opts.length ? opts : [{ id: uid(), value: "" }] });
  }));
  const addAxis = () => setAxes((prev) => {
    if (prev.length >= 2) return prev;
    const hasStorage = prev.some((a) => a.key === "storage");
    const hasWarna = prev.some((a) => a.key === "warna");
    const key: AxisKey = !hasWarna ? "warna" : !hasStorage ? "storage" : "custom";
    const name = key === "warna" ? "Warna" : key === "storage" ? "Storage" : "Variasi";
    return [...prev, ensureTrailingEmpty({ id: uid(), key, name, options: [] })];
  });
  const removeAxis = (id: string) => setAxes((prev) => prev.filter((a) => a.id !== id));

  const applyBulk = () => {
    const targets = combos.filter((c) => {
      const warna = warnaAxis ? (c.values[warnaAxis.id] ?? null) : null;
      const storage = storageAxis ? (c.values[storageAxis.id] ?? null) : null;
      return isGroupEdit || !existing[comboLookupKey(warna, storage)];
    });
    if (targets.length === 0) { toast.info("Tidak ada variasi baru untuk diterapkan"); return; }
    setComboValues((prev) => {
      const next = { ...prev };
      for (const c of targets) {
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
    toast.success(`Diterapkan ke ${targets.length} variasi`);
  };

  const addBekasUnit = (comboKey: string) => {
    setBekasUnitsByCombo((prev) => ({ ...prev, [comboKey]: [...(prev[comboKey] ?? []), newBekasUnit()] }));
  };
  const removeBekasUnit = (comboKey: string, unitId: string) => {
    setBekasUnitsByCombo((prev) => ({ ...prev, [comboKey]: (prev[comboKey] ?? []).filter((u) => u.id !== unitId) }));
  };
  const updateBekasUnit = (comboKey: string, unitId: string, patch: Partial<BekasUnit>) => {
    setBekasUnitsByCombo((prev) => ({
      ...prev,
      [comboKey]: (prev[comboKey] ?? []).map((u) => u.id === unitId ? { ...u, ...patch } : u),
    }));
  };
  const applyBekasBulk = () => {
    const allUnits = combos.flatMap((c) => (bekasUnitsByCombo[c.key] ?? []).map((u) => ({ cKey: c.key, u })));
    if (allUnits.length === 0) { toast.info("Tambah unit terlebih dahulu"); return; }
    setBekasUnitsByCombo((prev) => {
      const next: Record<string, BekasUnit[]> = { ...prev };
      for (const c of combos) {
        next[c.key] = (next[c.key] ?? []).map((u) => ({
          ...u,
          cost: bekasBulk.cost !== "" ? bekasBulk.cost : u.cost,
          price: bekasBulk.price !== "" ? bekasBulk.price : u.price,
          bh: bekasBulk.bh !== "" ? bekasBulk.bh : u.bh,
          garansiDays: bekasBulk.garansiDays !== "" ? bekasBulk.garansiDays : u.garansiDays,
        }));
      }
      return next;
    });
    toast.success(`Diterapkan ke ${allUnits.length} unit`);
  };

  const saveBekasSingle = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (!bStorage.trim()) { toast.error("Storage wajib"); return; }
    if (!bWarna.trim()) { toast.error("Warna wajib"); return; }
    if (bCost === "" || Number(bCost) < 0) { toast.error("Harga modal wajib"); return; }
    if (bPrice === "" || Number(bPrice) < 0) { toast.error("Harga jual wajib"); return; }
    if (!bImei.trim() || !/^\d{15}$/.test(bImei.trim())) { toast.error("IMEI 15 digit wajib untuk Bekas"); return; }
    if (bBh === "" || Number(bBh) < 0 || Number(bBh) > 100) { toast.error("BH 0-100 wajib"); return; }
    if (bGaransiOn && (!bGaransiDays || Number(bGaransiDays) <= 0)) { toast.error("Durasi garansi wajib >0"); return; }
    setSaving(true);
    try {
      if (isEdit && editProduct) {
        await updateProductVariant({
          id: editProduct.id,
          name: name.trim(),
          category,
          cost: Number(bCost),
          price: Number(bPrice),
          barcode: bBarcode.trim() || null,
          storage: bStorage.trim(),
          warna: bWarna.trim(),
          imei: bImei.trim(),
          bh_percent: Number(bBh),
          kondisi_notes: bKondisi.trim() || null,
          garansi_days: bGaransiOn ? Number(bGaransiDays) : null,
          stock_qty: 1,
        });
        if (bPhotoFile) {
          try { const fd = new FormData(); fd.append("file", bPhotoFile); await uploadProductPhoto(editProduct.id, fd); }
          catch (e) { toast.warning(`Produk tersimpan, foto gagal: ${e instanceof Error ? e.message : "coba lagi"}`); }
        }
        toast.success("Produk diperbarui");
        playPageTransition(); onOpenChange(false); onSuccess?.();
        return;
      }
      const res = await createProductAction({
        name: name.trim(), category, cost: Number(bCost), price: Number(bPrice),
        barcode: bBarcode.trim() || undefined, variant_type: "BEKAS", storage: bStorage.trim(), warna: bWarna.trim(),
        bh_percent: Number(bBh), kondisi_notes: bKondisi.trim() || null,
        garansi_days: bGaransiOn ? Number(bGaransiDays) : null, imei: bImei.trim(),
      } as any);
      if (!res.ok) { toast.error(res.error); return; }
      if (bPhotoFile) { try { const fd = new FormData(); fd.append("file", bPhotoFile); await uploadProductPhoto(res.id, fd); } catch (e) { toast.warning(`Produk tersimpan, foto gagal: ${e instanceof Error ? e.message : "coba lagi"}`); } }
      toast.success(`Unit Bekas ditambahkan — ${name} ${bStorage} ${bWarna}`);
      playPageTransition(); onOpenChange(false); onSuccess?.();
    } catch (e: any) { toast.error(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const saveBekasVariasi = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (duplicateAxisIds.size > 0) { toast.error("Nama variasi tidak boleh sama"); return; }
    if (activeAxes.length === 0) { toast.error("Isi minimal 1 variasi (opsi), atau matikan variasi untuk input single"); return; }
    if (!warnaAxis || !storageAxis) { toast.error("Variasi BEKAS harus memiliki sumbu Warna dan Storage"); return; }
    const units: { combo: ComboRow; warna: string; storage: string; unit: BekasUnit }[] = [];
    for (const c of combos) {
      const warna = c.values[warnaAxis.id] ?? null;
      const storage = c.values[storageAxis.id] ?? null;
      if (!warna || !storage) continue;
      for (const u of (bekasUnitsByCombo[c.key] ?? [])) units.push({ combo: c, warna, storage, unit: u });
    }
    if (units.length === 0) { toast.error("Tambahkan minimal 1 unit bekas pada kombinasi"); return; }
    const imeis = units.map((x) => x.unit.imei.trim());
    const imeiSet = new Set<string>();
    for (const { warna, storage, unit } of units) {
      const label = `${warna} / ${storage}`;
      if (!unit.imei.trim() || !/^\d{15}$/.test(unit.imei.trim())) { toast.error(`IMEI 15 digit wajib (${label})`); return; }
      if (imeiSet.has(unit.imei.trim())) { toast.error(`IMEI duplikat di form: ${unit.imei.trim()}`); return; }
      imeiSet.add(unit.imei.trim());
      if (unit.bh === "" || Number(unit.bh) < 0 || Number(unit.bh) > 100) { toast.error(`BH 0-100 wajib (${label})`); return; }
      if (unit.cost === "" || Number(unit.cost) < 0) { toast.error(`Harga modal wajib (${label})`); return; }
      if (unit.price === "" || Number(unit.price) < 0) { toast.error(`Harga jual wajib (${label})`); return; }
      if (unit.garansiOn && (!unit.garansiDays || Number(unit.garansiDays) <= 0)) { toast.error(`Durasi garansi wajib >0 (${label})`); return; }
    }
    setSaving(true);
    let created = 0;
    const errors: string[] = [];
    try {
      const parentKey = normalizeInventorySlug(name.trim());
      for (const { warna, storage, unit } of units) {
        const label = `${warna} / ${storage} / ${unit.imei.trim().slice(-4)}`;
        let savedId: string;
        if (isGroupEdit && unit.productId) {
          savedId = unit.productId;
          await updateProductVariant({
            id: savedId, name: name.trim(), category, parent_key: parentKey,
            cost: Number(unit.cost), price: Number(unit.price),
            barcode: unit.barcode.trim() || null, storage, warna,
            bh_percent: Number(unit.bh), kondisi_notes: unit.kondisi.trim() || null,
            garansi_days: unit.garansiOn ? Number(unit.garansiDays) : null,
            imei: unit.imei.trim(), stock_qty: 1,
          });
        } else {
          const res = await createProductAction({
            name: name.trim(), category, cost: Number(unit.cost), price: Number(unit.price),
            barcode: unit.barcode.trim() || undefined, variant_type: "BEKAS", storage, warna,
            bh_percent: Number(unit.bh), kondisi_notes: unit.kondisi.trim() || null,
            garansi_days: unit.garansiOn ? Number(unit.garansiDays) : null, imei: unit.imei.trim(),
          } as any);
          if (!res.ok) { errors.push(`${label}: ${res.error}`); continue; }
          savedId = res.id;
        }
        created++;
        if (unit.photo) { try { const fd = new FormData(); fd.append("file", unit.photo); await uploadProductPhoto(savedId, fd); } catch { /* ignore */ } }
      }
      if (errors.length && created) { toast.warning(`${created} unit tersimpan, ${errors.length} gagal: ${errors[0]}`); playPageTransition(); onSuccess?.(); }
      else if (errors.length) { toast.error(errors[0]); }
      else { toast.success(`${created} unit Bekas ${isGroupEdit ? "diperbarui" : "ditambahkan"} — ${name.trim()}`); playPageTransition(); onOpenChange(false); onSuccess?.(); }
    } catch (e: any) { toast.error(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const saveSingleBaru = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (!sStorage.trim()) { toast.error("Storage wajib"); return; }
    if (!sWarna.trim()) { toast.error("Warna wajib"); return; }
    if (sStock === "" || Number(sStock) < 0 || !Number.isInteger(Number(sStock))) { toast.error("Stok wajib (>=0, bilangan bulat)"); return; }
    if (sCost === "" || Number(sCost) < 0) { toast.error("Harga modal wajib"); return; }
    if (sPrice === "" || Number(sPrice) < 0) { toast.error("Harga jual wajib"); return; }
    setSaving(true);
    try {
      if (isEdit && editProduct) {
        await updateProductVariant({
          id: editProduct.id,
          name: name.trim(),
          category,
          stock_qty: Number(sStock),
          cost: Number(sCost),
          price: Number(sPrice),
          barcode: sBarcode.trim() || null,
          storage: sStorage.trim(),
          warna: sWarna.trim(),
        });
        if (sPhoto) {
          try { const fd = new FormData(); fd.append("file", sPhoto); await uploadProductPhoto(editProduct.id, fd); }
          catch { toast.warning("Produk tersimpan, foto gagal diunggah"); }
        }
        toast.success("Produk diperbarui");
        playPageTransition(); onOpenChange(false); onSuccess?.();
        return;
      }
      const res = await createProductAction({
        name: name.trim(), category, stock_qty: Number(sStock), cost: Number(sCost), price: Number(sPrice),
        barcode: sBarcode.trim() || undefined, variant_type: "BARU", storage: sStorage.trim(), warna: sWarna.trim(),
      } as any);
      if (!res.ok) { toast.error(res.error); return; }
      if (sPhoto) { try { const fd = new FormData(); fd.append("file", sPhoto); await uploadProductPhoto(res.id, fd); } catch { toast.warning("Produk tersimpan, foto gagal diunggah"); } }
      toast.success(`Produk ditambahkan — ${name} ${sStorage} ${sWarna}`);
      playPageTransition(); onOpenChange(false); onSuccess?.();
    } catch (e: any) { toast.error(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const saveBaruVariasi = async () => {
    if (!name.trim()) { toast.error("Nama produk wajib"); return; }
    if (duplicateAxisIds.size > 0) { toast.error("Nama variasi tidak boleh sama"); return; }
    if (activeAxes.length === 0) { toast.error("Isi minimal 1 variasi (opsi), atau matikan variasi untuk input single"); return; }
    if (!warnaAxis || !storageAxis) { toast.error("Variasi BARU harus memiliki sumbu Warna dan Storage"); return; }
    const enriched = combos.map((c) => {
      const warna = c.values[warnaAxis.id] ?? null;
      const storage = c.values[storageAxis.id] ?? null;
      const ex = existing[comboLookupKey(warna, storage)];
      return { ...c, warna, storage, ex };
    });
    const toCreate = isGroupEdit ? enriched : enriched.filter((c) => !c.ex);
    if (toCreate.length === 0) { toast.error(isGroupEdit ? "Tidak ada variasi untuk disimpan" : "Semua kombinasi sudah ada, tidak ada yang baru untuk disimpan"); return; }
    for (const c of toCreate) {
      const v = comboValues[c.key];
      const label = [c.warna, c.storage].filter(Boolean).join(" / ") || "Default";
      if (!c.warna) { toast.error(`Warna wajib untuk ${label}`); return; }
      if (!c.storage) { toast.error(`Storage wajib untuk ${label}`); return; }
      if (!v || v.stock === "" || Number(v.stock) < 0 || !Number.isInteger(Number(v.stock))) { toast.error(`Stok wajib (>=0, bilangan bulat) untuk ${label}`); return; }
      if (!v || v.cost === "" || Number(v.cost) < 0) { toast.error(`Harga modal wajib untuk ${label}`); return; }
      if (!v || v.price === "" || Number(v.price) < 0) { toast.error(`Harga jual wajib untuk ${label}`); return; }
    }
    setSaving(true);
    const created: { id: string; warna: string | null }[] = [];
    const errors: string[] = [];
    try {
      const parentKey = normalizeInventorySlug(name.trim());
      for (const c of toCreate) {
        const v = comboValues[c.key];
        const label = [c.warna, c.storage].filter(Boolean).join(" / ");
        if (isGroupEdit && c.ex?.id) {
          await updateProductVariant({
            id: c.ex.id, name: name.trim(), category, parent_key: parentKey,
            stock_qty: Number(v.stock), cost: Number(v.cost), price: Number(v.price),
            barcode: v.barcode.trim() || null, storage: c.storage!, warna: c.warna!,
          });
          created.push({ id: c.ex.id, warna: c.warna });
        } else {
          const res = await createProductAction({
            name: name.trim(), category, stock_qty: Number(v.stock), cost: Number(v.cost), price: Number(v.price),
            barcode: v.barcode.trim() || undefined, variant_type: "BARU", storage: c.storage!, warna: c.warna!,
          } as any);
          if (!res.ok) errors.push(`${label}: ${res.error}`); else created.push({ id: res.id, warna: c.warna });
        }
      }
      for (const item of created) {
        const photo = item.warna ? colorPhotos[norm(item.warna)] : null;
        if (!photo) continue;
        try { const fd = new FormData(); fd.append("file", photo); await uploadProductPhoto(item.id, fd); } catch { /* ignore */ }
      }
      if (errors.length && created.length) { toast.warning(`${created.length} varian tersimpan, ${errors.length} gagal: ${errors[0]}`); playPageTransition(); onSuccess?.(); }
      else if (errors.length) { toast.error(errors[0]); }
      else { toast.success(`${created.length} varian ${isGroupEdit ? "diperbarui" : "ditambahkan"} — ${name.trim()}`); playPageTransition(); onOpenChange(false); onSuccess?.(); }
    } catch (e: any) { toast.error(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const onSubmit = () => {
    if (variantType === "BEKAS") return variasiOn ? saveBekasVariasi() : saveBekasSingle();
    return variasiOn ? saveBaruVariasi() : saveSingleBaru();
  };

  const bulkReady = bulk.stock !== "" || bulk.cost !== "" || bulk.price !== "";
  const bekasBulkReady = bekasBulk.cost !== "" || bekasBulk.price !== "" || bekasBulk.bh !== "" || bekasBulk.garansiDays !== "";

  const renderAxesEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          {duplicateAxisIds.size > 0 && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircleIcon className="size-3.5" /> Nama variasi tidak boleh sama.</p>}
          {axes.length === 0 && <p className="text-xs text-muted-foreground">Belum ada variasi. Tambah variasi atau matikan variasi untuk input single.</p>}
        </div>
        {axes.length < 2 && <Button type="button" variant="outline" size="sm" onClick={addAxis}><PlusIcon className="size-4" /> Tambah Variasi</Button>}
      </div>
      {axes.length > 0 && (
        <div className="divide-y rounded-lg border bg-muted/20">
          {axes.map((axis, idx) => {
            const dup = duplicateAxisIds.has(axis.id);
            return (
              <div key={axis.id} className={`space-y-2 p-3 ${dup ? "bg-destructive/5" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs font-medium">Variasi {idx + 1}</span>
                  <Input value={axis.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setAxisName(axis.id, e.target.value)} placeholder={axis.key === "storage" ? "Storage" : "Warna"} className={`h-8 max-w-[220px] ${dup ? "border-destructive" : ""}`} />
                  <span className="text-[10px] text-muted-foreground">({axis.key})</span>
                  <div className="ml-auto"><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeAxis(axis.id)} aria-label="Hapus variasi"><Trash2Icon className="size-4" /></Button></div>
                </div>
                {dup && <p className="text-[11px] text-destructive">Nama variasi ini duplikat.</p>}
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Opsi (isi untuk menambah, kosongkan/hapus untuk mengurangi)</div>
                  <div className="flex flex-wrap gap-2">
                    {axis.options.map((opt) => {
                      const hasVal = opt.value.trim() !== "";
                      return (
                        <div key={opt.id} className="relative">
                          <Input
                            value={opt.value}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setOption(axis.id, opt.id, e.target.value)}
                            placeholder={axis.key === "storage" ? "cth. 128 GB" : "cth. White"}
                            className={`h-8 w-36 rounded-full [appearance:textfield] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-list-button]:hidden ${hasVal ? "pr-8" : ""}`}
                            list={axis.key === "storage" ? `storage-suggest-${axis.id}` : axis.key === "warna" ? `warna-suggest-${axis.id}` : undefined}
                          />
                          {hasVal && (
                            <button type="button" onClick={() => removeOption(axis.id, opt.id)} aria-label="Hapus opsi" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <XIcon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {axis.key === "storage" && <datalist id={`storage-suggest-${axis.id}`}>{STORAGE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>}
                  {axis.key === "warna" && <datalist id={`warna-suggest-${axis.id}`}>{WARNA_SUGGESTIONS.map((w) => <option key={w} value={w} />)}</datalist>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBaruSingle = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Storage *</Label>
          <Input value={sStorage} onChange={(e: ChangeEvent<HTMLInputElement>) => setSStorage(e.target.value)} placeholder="cth. 128 GB" list="single-storage-suggest" />
          <datalist id="single-storage-suggest">{STORAGE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="space-y-1.5"><Label>Warna *</Label>
          <Input value={sWarna} onChange={(e: ChangeEvent<HTMLInputElement>) => setSWarna(e.target.value)} placeholder="cth. Black" list="single-warna-suggest" />
          <datalist id="single-warna-suggest">{WARNA_SUGGESTIONS.map((w) => <option key={w} value={w} />)}</datalist>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Stok qty *</Label><Input type="number" min={0} value={sStock} onChange={(e: ChangeEvent<HTMLInputElement>) => setSStock(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Harga Modal *</Label><Input type="number" min={0} value={sCost} onChange={(e: ChangeEvent<HTMLInputElement>) => setSCost(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Harga Jual *</Label><Input type="number" min={0} value={sPrice} onChange={(e: ChangeEvent<HTMLInputElement>) => setSPrice(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Barcode (opsional)</Label>
        <div className="flex gap-2">
          <Input value={sBarcode} onChange={(e: ChangeEvent<HTMLInputElement>) => setSBarcode(e.target.value)} placeholder="Scan / ketik SKU" />
          <Button type="button" variant="outline" size="icon" aria-label="Scan barcode" onClick={() => { setScanTarget({ kind: "baru-single" }); setScanOpen(true); }} className="shrink-0"><ScanBarcodeIcon className="size-4" /></Button>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Foto produk (opsional)</Label><ProductPhotoPicker value={isEdit ? existingPhotoUrl : null} onFile={setSPhoto} disabled={saving} /></div>
    </div>
  );

  const renderBekasSingle = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Storage *</Label>
          <Input value={bStorage} onChange={(e: ChangeEvent<HTMLInputElement>) => setBStorage(e.target.value)} placeholder="cth. 128 GB" list="bekas-single-storage" />
          <datalist id="bekas-single-storage">{STORAGE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="space-y-1.5"><Label>Warna *</Label>
          <Input value={bWarna} onChange={(e: ChangeEvent<HTMLInputElement>) => setBWarna(e.target.value)} placeholder="cth. Black" list="bekas-single-warna" />
          <datalist id="bekas-single-warna">{WARNA_SUGGESTIONS.map((w) => <option key={w} value={w} />)}</datalist>
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
          <Button type="button" variant="outline" size="icon" aria-label="Scan barcode" onClick={() => { setScanTarget({ kind: "bekas-single" }); setScanOpen(true); }} className="shrink-0"><ScanBarcodeIcon className="size-4" /></Button>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Foto produk (opsional)</Label><ProductPhotoPicker value={isEdit ? existingPhotoUrl : null} onFile={setBPhotoFile} disabled={saving} /></div>
      <div className="space-y-1.5"><Label>Kondisi fisik notes</Label><Textarea value={bKondisi} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBKondisi(e.target.value)} rows={2} /></div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div><div className="text-sm font-medium">Garansi</div><div className="text-xs text-muted-foreground">Jika ON, wajib isi durasi hari</div></div>
        <Switch checked={bGaransiOn} onCheckedChange={setBGaransiOn} />
      </div>
      {bGaransiOn && <div className="space-y-1.5"><Label>Durasi garansi (hari) *</Label><Input type="number" min={1} value={bGaransiDays} onChange={(e: ChangeEvent<HTMLInputElement>) => setBGaransiDays(e.target.value)} /></div>}
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">Unit Bekas: per IMEI, stok 1→0, BH/kondisi/garansi per unit.</div>
    </div>
  );

  const renderBaruVariasi = () => (
    <div className="space-y-4">
      {renderAxesEditor()}
      {activeAxes.length > 0 && (
        <>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-medium">Terapkan ke semua</div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">Stok</Label><Input type="number" min={0} value={bulk.stock} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b) => ({ ...b, stock: e.target.value }))} className="h-8 w-28" /></div>
              <div className="space-y-1"><Label className="text-xs">Harga Modal</Label><Input type="number" min={0} value={bulk.cost} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b) => ({ ...b, cost: e.target.value }))} className="h-8 w-36" /></div>
              <div className="space-y-1"><Label className="text-xs">Harga Jual</Label><Input type="number" min={0} value={bulk.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setBulk((b) => ({ ...b, price: e.target.value }))} className="h-8 w-36" /></div>
              <Button type="button" variant="secondary" size="sm" onClick={applyBulk} disabled={!bulkReady}>Terapkan Ke Semua</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{isGroupEdit ? "Menerapkan nilai terisi ke semua variasi yang tampil." : "Menerapkan nilai terisi ke variasi baru yang tampil (kecuali yang sudah ada)."}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Daftar Variasi</Label>
            {combos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Isi opsi pada variasi untuk membentuk kombinasi tabel.</p>
            ) : (
              <div className="overflow-auto rounded-lg border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      {activeAxes.map((a) => <th key={a.id} className="px-3 py-2 text-left font-medium">{a.name || "Variasi"}</th>)}
                      {warnaAxis && <th className="px-3 py-2 text-left font-medium">Foto Warna</th>}
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
                      const warna = warnaAxis ? (c.values[warnaAxis.id] ?? null) : null;
                      const storage = storageAxis ? (c.values[storageAxis.id] ?? null) : null;
                      const ex = existing[comboLookupKey(warna, storage)];
                      // Di mode edit grup, baris "sudah ada" justru yang sedang diedit.
                      const disabled = isGroupEdit ? saving : (!!ex || saving);
                      const warnaKey = warna ? norm(warna) : "";
                      return (
                        <tr key={c.key} className={`border-t ${ex ? "bg-muted/30 text-muted-foreground" : ""}`}>
                          {activeAxes.map((a) => <td key={a.id} className="whitespace-nowrap px-3 py-2">{c.values[a.id] ?? "-"}</td>)}
                          {warnaAxis && (
                            <td className="px-3 py-2">{warna ? <PhotoPerWarna file={colorPhotos[warnaKey] ?? null} onFile={(f) => setColorPhotos((p) => ({ ...p, [warnaKey]: f }))} disabled={saving} /> : <span className="text-xs text-muted-foreground">-</span>}</td>
                          )}
                          <td className="px-3 py-2"><Input type="number" min={0} value={v.stock} onChange={(e: ChangeEvent<HTMLInputElement>) => setComboValues((p) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), stock: e.target.value } }))} className="h-8 w-24" disabled={disabled} /></td>
                          <td className="px-3 py-2"><Input type="number" min={0} value={v.cost} onChange={(e: ChangeEvent<HTMLInputElement>) => setComboValues((p) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), cost: e.target.value } }))} className="h-8 w-32" disabled={disabled} /></td>
                          <td className="px-3 py-2"><Input type="number" min={0} value={v.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setComboValues((p) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), price: e.target.value } }))} className="h-8 w-32" disabled={disabled} /></td>
                          <td className="px-3 py-2"><div className="flex gap-1"><Input value={v.barcode} onChange={(e: ChangeEvent<HTMLInputElement>) => setComboValues((p) => ({ ...p, [c.key]: { ...(p[c.key] ?? v), barcode: e.target.value } }))} className="h-8 w-36" disabled={disabled} placeholder="opsional" /><Button type="button" variant="outline" size="icon-sm" disabled={disabled} aria-label="Scan" onClick={() => { setScanTarget({ kind: "baru-combo", key: c.key }); setScanOpen(true); }}><ScanBarcodeIcon className="size-3.5" /></Button></div></td>
                          <td className="px-3 py-2 text-xs">{ex ? <span className="font-medium text-amber-600">{isGroupEdit ? "Tersimpan" : "Sudah ada"} ({ex.sku})</span> : <span className="text-emerald-600">Baru</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {activeAxes.length === 0 && <p className="text-xs text-muted-foreground">Tambahkan variasi & opsi agar tabel kombinasi muncul.</p>}
    </div>
  );

  const renderBekasVariasi = () => (
    <div className="space-y-4">
      {renderAxesEditor()}
      {activeAxes.length > 0 && (
        <>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-medium">Terapkan ke semua unit</div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">Harga Modal</Label><Input type="number" min={0} value={bekasBulk.cost} onChange={(e: ChangeEvent<HTMLInputElement>) => setBekasBulk((b) => ({ ...b, cost: e.target.value }))} className="h-8 w-32" /></div>
              <div className="space-y-1"><Label className="text-xs">Harga Jual</Label><Input type="number" min={0} value={bekasBulk.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setBekasBulk((b) => ({ ...b, price: e.target.value }))} className="h-8 w-32" /></div>
              <div className="space-y-1"><Label className="text-xs">BH %</Label><Input type="number" min={0} max={100} value={bekasBulk.bh} onChange={(e: ChangeEvent<HTMLInputElement>) => setBekasBulk((b) => ({ ...b, bh: e.target.value }))} className="h-8 w-24" /></div>
              <div className="space-y-1"><Label className="text-xs">Garansi (hari)</Label><Input type="number" min={1} value={bekasBulk.garansiDays} onChange={(e: ChangeEvent<HTMLInputElement>) => setBekasBulk((b) => ({ ...b, garansiDays: e.target.value }))} className="h-8 w-28" /></div>
              <Button type="button" variant="secondary" size="sm" onClick={applyBekasBulk} disabled={!bekasBulkReady}>Terapkan Ke Semua</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Menerapkan nilai terisi ke semua unit baru pada kombinasi yang tampil.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Unit Bekas per Kombinasi</Label>
            {combos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Isi opsi pada variasi untuk membentuk kombinasi.</p>
            ) : (
              combos.map((c) => {
                const warna = warnaAxis ? (c.values[warnaAxis.id] ?? null) : null;
                const storage = storageAxis ? (c.values[storageAxis.id] ?? null) : null;
                const label = [warna, storage].filter(Boolean).join(" / ") || activeAxes.map((a) => c.values[a.id] ?? "-").join(" / ");
                const units = bekasUnitsByCombo[c.key] ?? [];
                return (
                  <div key={c.key} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{label} <span className="text-xs font-normal text-muted-foreground">({units.length} unit)</span></div>
                      <Button type="button" variant="outline" size="sm" onClick={() => addBekasUnit(c.key)} disabled={!warna || !storage}><PlusIcon className="size-4" /> Tambah Unit</Button>
                    </div>
                    {(!warna || !storage) && <p className="text-xs text-amber-600">Warna & Storage wajib terisi untuk menambah unit BEKAS.</p>}
                    {units.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Belum ada unit. Tambah unit (setiap unit = IMEI unik).</p>
                    ) : (
                      <div className="overflow-auto rounded-md border">
                        <table className="w-full min-w-[980px] text-sm">
                          <thead className="bg-muted/40 text-xs">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium">IMEI *</th>
                              <th className="px-2 py-2 text-left font-medium">BH % *</th>
                              <th className="px-2 py-2 text-left font-medium">Harga Modal *</th>
                              <th className="px-2 py-2 text-left font-medium">Harga Jual *</th>
                              <th className="px-2 py-2 text-left font-medium">Barcode</th>
                              <th className="px-2 py-2 text-left font-medium">Kondisi</th>
                              <th className="px-2 py-2 text-left font-medium">Garansi</th>
                              <th className="px-2 py-2 text-left font-medium">Foto</th>
                              <th className="px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {units.map((u) => (
                              <tr key={u.id} className="border-t align-top">
                                <td className="px-2 py-2"><Input value={u.imei} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { imei: e.target.value.replace(/\D/g, "").slice(0, 15) })} placeholder="15 digit" inputMode="numeric" maxLength={15} className="h-8 w-40" /></td>
                                <td className="px-2 py-2"><Input type="number" min={0} max={100} value={u.bh} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { bh: e.target.value })} className="h-8 w-20" /></td>
                                <td className="px-2 py-2"><Input type="number" min={0} value={u.cost} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { cost: e.target.value })} className="h-8 w-28" /></td>
                                <td className="px-2 py-2"><Input type="number" min={0} value={u.price} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { price: e.target.value })} className="h-8 w-28" /></td>
                                <td className="px-2 py-2"><div className="flex gap-1"><Input value={u.barcode} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { barcode: e.target.value })} className="h-8 w-28" placeholder="opsional" /><Button type="button" variant="outline" size="icon-sm" aria-label="Scan" onClick={() => { setScanTarget({ kind: "bekas-unit", comboKey: c.key, unitId: u.id }); setScanOpen(true); }}><ScanBarcodeIcon className="size-3.5" /></Button></div></td>
                                <td className="px-2 py-2"><Textarea value={u.kondisi} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateBekasUnit(c.key, u.id, { kondisi: e.target.value })} rows={1} className="min-h-8 w-36" placeholder="opsional" /></td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-2">
                                    <Switch checked={u.garansiOn} onCheckedChange={(v) => updateBekasUnit(c.key, u.id, { garansiOn: v })} />
                                    {u.garansiOn && <Input type="number" min={1} value={u.garansiDays} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBekasUnit(c.key, u.id, { garansiDays: e.target.value })} className="h-8 w-20" placeholder="hari" />}
                                  </div>
                                </td>
                                <td className="px-2 py-2"><PhotoPerWarna file={u.photo} onFile={(f) => updateBekasUnit(c.key, u.id, { photo: f })} disabled={saving} /></td>
                                <td className="px-2 py-2"><Button type="button" variant="ghost" size="icon-sm" onClick={() => removeBekasUnit(c.key, u.id)} aria-label="Hapus unit"><Trash2Icon className="size-4" /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      {activeAxes.length === 0 && <p className="text-xs text-muted-foreground">Tambahkan variasi & opsi agar kombinasi/unit muncul.</p>}
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
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">
                  {isEdit ? "Edit Produk" : `Tambah Produk — ${branch.label}`}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {isGroupEdit
                    ? `Ubah ${editGroup?.type === "BEKAS" ? "unit bekas" : "varian"} pada grup "${editGroup?.group.name}".`
                    : isEdit
                    ? "Ubah data produk/varian yang dipilih."
                    : variantType === "BARU"
                      ? (variasiOn ? "Variasi aktif: atur sumbu/opsi dan simpan kombinasi." : "Single produk (variasi nonaktif).")
                      : (variasiOn ? "Variasi BEKAS aktif: kombinasi + unit per IMEI." : "Unit Bekas: per IMEI, BH, kondisi, garansi (single unit).")}
                </DialogPrimitive.Description>
              </div>              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {!isEdit && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Tipe</span>
                  <div className="flex gap-1 rounded-lg border p-1">
                    <button type="button" onClick={() => setVariantType("BARU")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variantType === "BARU" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Baru</button>
                    <button type="button" onClick={() => setVariantType("BEKAS")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variantType === "BEKAS" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Bekas</button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative space-y-1.5">
                <Label>Nama produk *</Label>
                <Input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => { setName(e.target.value); setExistingLoadedFor(""); }} onFocus={() => suggestions.length && setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} placeholder="iPhone 14 Pro, Samsung A54..." />
                {showSuggest && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 shadow-lg">
                    {suggestions.map((s) => (<button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); setName(s); setExistingLoadedFor(""); setShowSuggest(false); }} className="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent">{s}</button>))}
                  </div>
                )}
                {!isEdit && <p className="text-[11px] text-muted-foreground">Nama existing = reuse grup (parent_key){variantType === "BARU" ? " & deteksi varian BARU yang sudah ada." : "."}</p>}
              </div>
              <div className="space-y-1.5"><Label>Kategori *</Label>
                <Select value={category} onValueChange={(v) => setCategory((v as string) ?? "Gadget")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>

            {(!isEdit || isGroupEdit) && (
              <div className="rounded-lg border">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Label className="text-sm font-semibold">Variasi</Label>
                  {!isEdit && <Switch checked={variasiOn} onCheckedChange={setVariasiOn} />}
                </div>
                {(variasiOn || isGroupEdit) && (
                  <div key={`${variantType}-on`} className="animate-in fade-in-0 slide-in-from-top-1 border-t p-3 duration-200">
                    {variantType === "BARU" ? renderBaruVariasi() : renderBekasVariasi()}
                  </div>
                )}
              </div>
            )}
            {!isGroupEdit && (!variasiOn || isEdit) && (
              <div key={`${variantType}-off`} className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {variantType === "BARU" ? renderBaruSingle() : renderBekasSingle()}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={onSubmit} disabled={saving} loading={saving}>
              {isEdit ? "Simpan Perubahan" : (variantType === "BARU" ? (variasiOn ? "Simpan Variasi" : "Simpan Produk") : (variasiOn ? "Simpan Unit Bekas" : "Simpan Unit Bekas"))}
            </Button>
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
          if (scanTarget?.kind === "bekas-single") setBBarcode(value);
          else if (scanTarget?.kind === "baru-single") setSBarcode(value);
          else if (scanTarget?.kind === "baru-combo") setComboValues((p) => ({ ...p, [scanTarget.key]: { ...(p[scanTarget.key] ?? { stock: "", cost: "", price: "", barcode: "" }), barcode: value } }));
          else if (scanTarget?.kind === "bekas-unit") updateBekasUnit(scanTarget.comboKey, scanTarget.unitId, { barcode: value });
          setScanTarget(null);
        }}
      />
    </DialogPrimitive.Root>
  );
}
