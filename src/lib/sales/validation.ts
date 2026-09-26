export type SaleProductSnapshot = {
  id: string;
  name: string;
  stock_qty: number;
  is_serialized: boolean;
  price: number;
};

export type SaleItemInput = {
  product_id: string;
  qty: number;
  unit_price: number;
  imei1?: string;
};

export function validateSaleItems(items: SaleItemInput[], products: SaleProductSnapshot[]) {
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
  }
}
