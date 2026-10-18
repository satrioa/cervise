export type SaleProductSnapshot = {
  id: string;
  name: string;
  stock_qty: number;
  is_serialized: boolean;
  price: number;
  /** IMEI milik unit itu sendiri, bukan yang diketik kasir. */
  imei: string | null;
};

export type SaleItemInput = {
  product_id: string;
  qty: number;
  unit_price: number;
  imei1?: string;
};

export type ValidateSaleOptions = {
  /**
   * Wajib, bukan opsional dengan default.
   *
   * Flag ini menentukan apakah harga boleh berbeda dari harga produk. Kalau punya
   * default yang longgar, pemanggil yang lupa mengirimnya akan kembali ke
   * kondisi sekarang: harga kasir dibuang diam-diam.
   */
  canOverridePrice: boolean;
};

export function validateSaleItems(
  items: SaleItemInput[],
  products: SaleProductSnapshot[],
  options: ValidateSaleOptions,
) {
  if (items.length === 0) throw new Error("Keranjang kosong");
  const productMap = new Map(products.map((product) => [product.id, product]));
  const seen = new Set<string>();

  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error("Qty harus bilangan bulat > 0");
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      throw new Error("Harga harus valid");
    }
    const product = productMap.get(item.product_id);
    if (!product) throw new Error("Produk tidak ditemukan");
    if (seen.has(item.product_id)) throw new Error("Produk hanya boleh satu baris");
    seen.add(item.product_id);
    if (product.is_serialized && item.qty !== 1) {
      throw new Error(`${product.name} wajib qty 1 (IMEI)`);
    }
    if (item.qty > product.stock_qty) {
      throw new Error(`Stok ${product.name} tidak cukup (sisa ${product.stock_qty})`);
    }
    if (product.is_serialized && !item.imei1?.trim()) {
      throw new Error(`IMEI wajib untuk ${product.name}`);
    }

    // Dulu harga yang diketik kasir diganti diam-diam dengan harga produk.
    // Frontliner yang mengubah Rp 100.000 jadi Rp 1 melihat "Total Rp1" di
    // layar, tapi server menyimpan total Rp 100.000 dan menunggu Rp 100.000 di
    // laci - jadi uang Rp 1 yang benar-benar diterima hilang, dan ada piutang
    // yang tidak bisa ditagih. Sekarang Pricing ditolak, bukan diabaikan.
    if (!options.canOverridePrice && item.unit_price !== product.price) {
      throw new Error(
        `Harga ${product.name} tidak boleh diubah. Muat ulang keranjang lalu ulangi.`,
      );
    }

    // IMEI harus milik unit yangDijual. Hanya memeriksa "IMEI ini belum pernah
    // dipakai di penjualan lain" tidak cukup: barang BEKAS dengan imei
    // 356938035412345 bisa terjual dengan imei1 "356938035412999", dan catatan
    // penjualan plus pencarian garansi lalu membawa IMEI perangkat lain.
    if (product.is_serialized && item.imei1?.trim()) {
      const expected = product.imei?.trim();
      if (expected && item.imei1.trim() !== expected) {
        throw new Error(`IMEI ${product.name} harus ${expected}`);
      }
    }
  }
}