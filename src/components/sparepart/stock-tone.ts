export interface SparepartRow {
  id?: string;
  sku: string;
  name: string;
  variant: string;
  category: string;
  price: number;
  stock: number;
  capacity: number;
  thumb: string;
  bg: string;
  is_active?: boolean;
  unit?: string;
  cost_cents?: number;
  price_cents?: number;
  min_stock?: number;
}

export type StockStatus = "Tersedia" | "Menipis" | "Habis";

export function stockTone(p: Pick<SparepartRow, "stock">): { label: StockStatus; cls: string; barCls: string } {
  if (p.stock === 0) return { label: "Habis", cls: "border-destructive/30 text-destructive", barCls: "bg-destructive" };
  if (p.stock < 10) return { label: "Menipis", cls: "border-amber-500/30 text-amber-700 dark:text-amber-400", barCls: "bg-amber-500" };
  return { label: "Tersedia", cls: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400", barCls: "bg-emerald-500" };
}
