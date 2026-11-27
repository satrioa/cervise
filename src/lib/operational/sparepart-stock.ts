/**
 * Klasifikasi stok sparepart untuk KPI dan kartu peringatan.
 *
 * Ambang disimpan per baris (`low_stock_threshold`), dengan default 5 untuk
 * data lama yang belum punya kolomnilai.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export type SparepartStockInput = {
  name: string;
  stock_qty: number;
  low_stock_threshold?: number | null;
};

export type SparepartStockSummary = {
  totalJenis: number;
  totalUnit: number;
  habis: number;
  menipis: number;
};

function thresholdOf(row: SparepartStockInput): number {
  const value = Number(row.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD;
}

function stockOf(row: SparepartStockInput): number {
  const value = Number(row.stock_qty ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function summarizeSparepartStock(rows: SparepartStockInput[]): SparepartStockSummary {
  let totalUnit = 0;
  let habis = 0;
  let menipis = 0;
  for (const row of rows) {
    const stock = stockOf(row);
    totalUnit += stock;
    if (stock <= 0) habis += 1;
    else if (stock <= thresholdOf(row)) menipis += 1;
  }
  return { totalJenis: rows.length, totalUnit, habis, menipis };
}

/** Baris yang perlu perhatian: stok habis atau tidak lebih dari ambangnya. */
export function lowStockRows<T extends SparepartStockInput>(rows: T[]): T[] {
  return rows.filter((row) => stockOf(row) <= thresholdOf(row));
}
