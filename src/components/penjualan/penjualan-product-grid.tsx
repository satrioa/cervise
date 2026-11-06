"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyPlain } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/photos";
import { productThumbnail } from "@/lib/product-thumbnail";
import type { ProductRow } from "@/app/app/penjualan/actions";
import {
  defaultSelection,
  groupSaleProducts,
  resolveVariant,
  selectColour,
  selectStorage,
  variantOptions,
  type VariantGroup,
  type VariantSelection,
} from "@/lib/sales/variant-selection";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function productPhoto(path: string | null | undefined): string | null {
  return publicPhotoUrl(SUPABASE_URL, path);
}

function groupPhoto(group: VariantGroup<ProductRow>): string | null {
  for (const variant of group.variants) {
    const url = productPhoto(variant.image_url);
    if (url) return url;
  }
  return null;
}

function stockTone(stock: number) {
  if (stock === 0) return "text-destructive";
  if (stock < 3) return "text-amber-600";
  return "text-emerald-600";
}

function ProductImage({
  src,
  alt,
  fallback,
  className,
}: {
  src: string | null;
  alt: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={!failed && src ? src : fallback}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, 240px"
      unoptimized
      onError={() => setFailed(true)}
      className={className ?? "object-contain p-2"}
    />
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : disabled
            ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/40"
            : "border-border bg-card text-foreground hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}

function VariantCard({
  group,
  onAdd,
}: {
  group: VariantGroup<ProductRow>;
  onAdd: (product: ProductRow, qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [qty, setQty] = useState(1);

  const activeSelection = selection ?? defaultSelection(group);
  const selectedVariant = resolveVariant(group, activeSelection);
  const warnaOptions = variantOptions(group, activeSelection, "warna");
  const storageOptions = variantOptions(group, activeSelection, "storage");
  const disabled = group.totalStock === 0;
  const canAdd =
    selectedVariant != null &&
    selectedVariant.stock_qty >= qty &&
    selectedVariant.stock_qty > 0;
  const fallbackPhoto = groupPhoto(group);
  const sheetPhoto = productPhoto(selectedVariant?.image_url) ?? fallbackPhoto;

  const openSheet = () => {
    if (disabled) return;
    setSelection(defaultSelection(group));
    setQty(1);
    setOpen(true);
  };

  const updateSelection = (next: VariantSelection) => {
    setSelection(next);
    const nextVariant = resolveVariant(group, next);
    if (nextVariant && qty > nextVariant.stock_qty) {
      setQty(Math.max(1, nextVariant.stock_qty));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        disabled={disabled}
        className="group flex flex-col overflow-hidden rounded-xl border bg-card p-1.5 text-left shadow-xs/5 transition-colors hover:bg-muted/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/40">
          <ProductImage
            src={fallbackPhoto}
            alt={group.parent.name}
            fallback={productThumbnail({ variantType: group.parent.variant_type })}
          />
          <Badge
            variant="secondary"
            size="sm"
            className={`absolute left-1.5 top-1.5 border-0 px-1.5 py-0 text-[9px] font-semibold ${
              group.isBekas ? "bg-amber-500 text-white" : "bg-sky-500 text-white"
            }`}
          >
            {group.isBekas ? "Bekas" : "Baru"}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col px-0.5 pt-1.5">
          <div className="line-clamp-1 text-[12px] font-semibold leading-tight">
            {group.parent.name}
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-sky-600 dark:text-sky-400">
            {formatCurrencyPlain(group.minPrice)}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between border-t px-0.5 pt-1.5 text-[10px]">
          <span className="text-muted-foreground">Stok</span>
          <span className={`font-mono font-semibold tabular-nums ${stockTone(group.totalStock)}`}>
            {group.totalStock}
          </span>
        </div>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border bg-background shadow-2xl outline-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted/40">
              <ProductImage
                src={sheetPhoto}
                alt={group.parent.name}
                fallback={productThumbnail({
                  variantType: selectedVariant?.variant_type ?? group.parent.variant_type,
                })}
                className="object-contain p-4"
              />
              <DialogPrimitive.Close
                aria-label="Tutup"
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
              >
                <XIcon className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold leading-tight">{group.parent.name}</span>
                <Badge
                  variant="secondary"
                  size="sm"
                  className={`shrink-0 border-0 text-[10px] font-semibold ${
                    group.isBekas ? "bg-amber-500 text-white" : "bg-sky-500 text-white"
                  }`}
                >
                  {group.isBekas ? "Bekas" : "Baru"}
                </Badge>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {selectedVariant?.sku ?? "Pilih varian"}
              </div>

              {warnaOptions.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Warna</div>
                  <div className="flex flex-wrap gap-2">
                    {warnaOptions.map((option) => (
                      <Chip
                        key={option.value}
                        active={activeSelection.warna === option.value}
                        disabled={option.disabled}
                        onClick={() => updateSelection(selectColour(group, activeSelection, option.value))}
                      >
                        {option.value}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {storageOptions.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Storage</div>
                  <div className="flex flex-wrap gap-2">
                    {storageOptions.map((option) => (
                      <Chip
                        key={option.value}
                        active={activeSelection.storage === option.value}
                        disabled={option.disabled}
                        onClick={() => updateSelection(selectStorage(group, activeSelection, option.value))}
                      >
                        {option.value}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">Qty</div>
                  <div className="text-[11px] text-muted-foreground">
                    Stok {selectedVariant?.stock_qty ?? 0}
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full border bg-background p-0.5">
                  <button
                    type="button"
                    aria-label="Kurangi qty"
                    disabled={qty <= 1}
                    onClick={() => setQty((value) => Math.max(1, value - 1))}
                    className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                  >
                    <MinusIcon className="size-4" />
                  </button>
                  <span className="w-7 text-center font-mono text-sm font-medium">{qty}</span>
                  <button
                    type="button"
                    aria-label="Tambah qty"
                    disabled={!selectedVariant || qty >= selectedVariant.stock_qty}
                    onClick={() =>
                      setQty((value) =>
                        Math.min(selectedVariant?.stock_qty ?? value, value + 1),
                      )
                    }
                    className="flex size-8 items-center justify-center rounded-full bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40"
                  >
                    <PlusIcon className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono text-base font-semibold tabular-nums">
                  {formatCurrencyPlain((selectedVariant?.price ?? 0) * qty)}
                </span>
              </div>

              <button
                type="button"
                disabled={!canAdd}
                onClick={() => {
                  if (!canAdd || !selectedVariant) return;
                  onAdd(selectedVariant, qty);
                  setOpen(false);
                }}
                className="mt-4 w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {!selectedVariant
                  ? "Pilih varian"
                  : selectedVariant.stock_qty === 0
                    ? "Stok habis"
                    : "Tambah ke keranjang"}
              </button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

export function PenjualanProductGrid({
  products,
  onAdd,
}: {
  products: ProductRow[];
  onAdd: (product: ProductRow, qty: number) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Tidak ada produk — tambah di Inventori
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {groupSaleProducts(products).map((group) => (
        <VariantCard key={group.key} group={group} onAdd={onAdd} />
      ))}
    </div>
  );
}
