import type { ProductRow } from "@/app/app/penjualan/actions";

/** Satu baris keranjang POS. Dipakai keranjang, rincian pesanan, dan checkout. */
export type PosCartItem = {
  product: ProductRow;
  qty: number;
  unit_price: number;
  imei1?: string;
  imei2?: string;
  warna?: string;
};

export type PosCustomer = { id: string; name: string; phone: string; phoneDisplay: string };

/** Customer baru yang disimpan hanya setelah penjualan berhasil. */
export type PosNewCustomer = { name: string; phone: string };
