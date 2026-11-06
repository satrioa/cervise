"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PackageIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { updateProductVariant } from "@/app/app/inventori/actions";
import { variantLabel, type InventoryProduct } from "@/lib/operational/inventori";
import { playPageTransition } from "@/components/layout/page-transition";

type Props = {
  product: InventoryProduct | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

/** Edit cepat satu varian; stok hanya bisa diubah untuk varian BARU. */
export function EditProductDialog({ product, onOpenChange, onSuccess }: Props) {
  return (
    <DialogPrimitive.Root open={product !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background p-0 shadow-2xl">
          {product ? <EditProductForm key={product.id} product={product} onOpenChange={onOpenChange} onSuccess={onSuccess} /> : null}
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function EditProductForm({
  product,
  onOpenChange,
  onSuccess,
}: {
  product: InventoryProduct;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [cost, setCost] = useState(product.cost == null ? "" : String(product.cost));
  const [price, setPrice] = useState(product.price == null ? "" : String(product.price));
  const [stockQty, setStockQty] = useState(product.stock_qty == null ? "" : String(product.stock_qty));
  const [kondisi, setKondisi] = useState(product.kondisi_notes ?? "");
  const [garansiDays, setGaransiDays] = useState(product.garansi_days == null ? "" : String(product.garansi_days));
  const [saving, setSaving] = useState(false);
  const isBekas = product.variant_type === "BEKAS";

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama produk wajib");
      return;
    }
    setSaving(true);
    try {
      await updateProductVariant({
        id: product.id,
        name: name.trim(),
        cost: cost === "" ? null : Number(cost),
        price: price === "" ? null : Number(price),
        stock_qty: isBekas || stockQty === "" ? null : Number(stockQty),
        kondisi_notes: isBekas ? kondisi.trim() || null : null,
        garansi_days: isBekas && garansiDays !== "" ? Number(garansiDays) : null,
      });
      playPageTransition();
      toast.success("Produk diperbarui");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
          <PackageIcon className="size-4" />
        </div>
        <div>
          <DialogPrimitive.Title className="font-heading text-base font-semibold">Edit Produk</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-muted-foreground">
            {variantLabel(product)}
          </DialogPrimitive.Description>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="space-y-1.5">
          <Label>Nama produk *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Harga Modal</Label>
            <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Harga Jual</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        {isBekas ? (
          <>
            <div className="space-y-1.5">
              <Label>Kondisi fisik</Label>
              <Textarea rows={2} value={kondisi} onChange={(e) => setKondisi(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Garansi (hari)</Label>
              <Input type="number" min={1} value={garansiDays} onChange={(e) => setGaransiDays(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label>Stok</Label>
            <Input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
        <Button onClick={handleSave} disabled={saving} loading={saving}>Simpan Perubahan</Button>
      </div>
    </>
  );
}
