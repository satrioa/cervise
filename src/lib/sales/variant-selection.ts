/**
 * Aturan pemilihan varian POS. Fungsi murni supaya kombinasi warna+storage
 * yang tidak ada tidak pernah "jatuh" ke varian lain tanpa disadari.
 */

export type SaleVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_qty: number;
  variant_type: "BARU" | "BEKAS";
  storage: string | null;
  warna: string | null;
  parent_key: string | null;
};

export type VariantGroup<T extends SaleVariant> = {
  key: string;
  parent: T;
  variants: T[];
  totalStock: number;
  minPrice: number;
  isBekas: boolean;
};

export type VariantSelection = {
  warna: string | null;
  storage: string | null;
};

export function groupSaleProducts<T extends SaleVariant>(products: T[]): VariantGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const product of products) {
    const parentKey = product.parent_key?.trim() || product.name;
    const key = `${product.variant_type}:${parentKey}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(product);
    else map.set(key, [product]);
  }

  return Array.from(map.entries()).map(([key, variants]) => ({
    key,
    // Tidak ada baris produk induk di database. Varian yang masih ada stok
    // adalah wakil paling jujur untuk nama dan foto kartu.
    parent: variants.find((variant) => variant.stock_qty > 0) ?? variants[0],
    variants,
    totalStock: variants.reduce((sum, variant) => sum + (variant.stock_qty ?? 0), 0),
    minPrice: Math.min(...variants.map((variant) => variant.price ?? 0)),
    isBekas: variants[0].variant_type === "BEKAS",
  }));
}

export function defaultSelection<T extends SaleVariant>(group: VariantGroup<T>): VariantSelection {
  const variant = group.variants.find((item) => item.stock_qty > 0) ?? group.variants[0];
  return { warna: variant.warna ?? null, storage: variant.storage ?? null };
}

export function resolveVariant<T extends SaleVariant>(
  group: VariantGroup<T>,
  selection: VariantSelection,
): T | null {
  return (
    group.variants.find(
      (variant) =>
        (variant.warna ?? null) === selection.warna &&
        (variant.storage ?? null) === selection.storage,
    ) ?? null
  );
}

function firstMatching<T extends SaleVariant>(
  group: VariantGroup<T>,
  predicate: (variant: T) => boolean,
): T | undefined {
  return group.variants.find(predicate);
}

export type VariantOption = {
  value: string;
  disabled: boolean;
};

/**
 * Opsi warna dinilai terhadap storage yang sedang dipilih. Opsi storage
 * dinilai terhadap warna yang sedang dipilih. Kombinasi tanpa baris varian
 * ditandai disabled, bukan dihilangkan, supaya kasir tetap melihat pilihan
 * yang memang tidak tersedia.
 */
export function variantOptions<T extends SaleVariant>(
  group: VariantGroup<T>,
  selection: VariantSelection,
  dimension: "warna" | "storage",
): VariantOption[] {
  const values = Array.from(
    new Set(
      group.variants
        .map((variant) => variant[dimension])
        .filter((value): value is string => Boolean(value && value.trim())),
    ),
  );

  return values.map((value) => {
    const candidate =
      dimension === "warna"
        ? firstMatching(
            group,
            (variant) =>
              variant.warna === value &&
              (selection.storage == null || variant.storage === selection.storage),
          )
        : firstMatching(
            group,
            (variant) =>
              variant.storage === value &&
              (selection.warna == null || variant.warna === selection.warna),
          );
    return { value, disabled: !candidate };
  });
}

function firstAvailableStorage<T extends SaleVariant>(
  group: VariantGroup<T>,
  warna: string | null,
): string | null {
  const match =
    group.variants.find((variant) => variant.warna === warna && variant.stock_qty > 0) ??
    group.variants.find((variant) => variant.warna === warna);
  return match?.storage ?? null;
}

function firstAvailableColour<T extends SaleVariant>(
  group: VariantGroup<T>,
  storage: string | null,
): string | null {
  const match =
    group.variants.find((variant) => variant.storage === storage && variant.stock_qty > 0) ??
    group.variants.find((variant) => variant.storage === storage);
  return match?.warna ?? null;
}

/**
 * Ganti warna tanpa menyisakan storage yang tidak ada untuk warna itu.
 * Kalau storage lama masih valid, pertahankan; kalau tidak, pilih storage
 * pertama yang tersedia.
 */
export function selectColour<T extends SaleVariant>(
  group: VariantGroup<T>,
  selection: VariantSelection,
  warna: string,
): VariantSelection {
  const stillValid =
    selection.storage != null &&
    group.variants.some(
      (variant) => variant.warna === warna && variant.storage === selection.storage,
    );
  return {
    warna,
    storage: stillValid ? selection.storage : firstAvailableStorage(group, warna),
  };
}

export function selectStorage<T extends SaleVariant>(
  group: VariantGroup<T>,
  selection: VariantSelection,
  storage: string,
): VariantSelection {
  const stillValid =
    selection.warna != null &&
    group.variants.some(
      (variant) => variant.storage === storage && variant.warna === selection.warna,
    );
  return {
    warna: stillValid ? selection.warna : firstAvailableColour(group, storage),
    storage,
  };
}
