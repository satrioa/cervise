import type { InventoryProduct } from "./inventori";

/** Baris draft opname. Murni, tanpa Supabase/React, supaya bisa diuji langsung. */
export type OpnameLineDraft = {
  refId: string;
  sku: string;
  name: string;
  imei: string | null;
  snapshotQty: number;
  countedQty: number;
  cost: number;
};

export type OpnameSparepart = {
  id: string;
  sku: string;
  name: string;
  stock_qty: number;
  cost: number;
};

export type OpnameSummary = {
  total: number;
  counted: number;
  matched: number;
  shortage: number;
  surplus: number;
  varianceValue: number;
};

export function computeVariance(
  line: Pick<OpnameLineDraft, "snapshotQty" | "countedQty">,
): number {
  return line.countedQty - line.snapshotQty;
}

/**
 * BEKAS dengan IMEI dihitung per unit (satu baris per IMEI, snapshot 1).
 * Baris tanpa IMEI — termasuk BEKAS tanpa IMEI — memakai stock_qty sebagaimana adanya.
 */
export function buildProductSnapshot(products: InventoryProduct[]): OpnameLineDraft[] {
  const out: OpnameLineDraft[] = [];
  for (const p of products) {
    const common = { sku: p.sku, name: p.name, cost: p.cost ?? 0 };
    if (p.variant_type === "BEKAS" && p.imei?.trim()) {
      out.push({ ...common, refId: p.id, imei: p.imei.trim(), snapshotQty: 1, countedQty: 0 });
    } else {
      out.push({
        ...common,
        refId: p.id,
        imei: null,
        snapshotQty: p.stock_qty ?? 0,
        countedQty: 0,
      });
    }
  }
  return out;
}

export function buildSparepartSnapshot(rows: OpnameSparepart[]): OpnameLineDraft[] {
  return rows.map((r) => ({
    refId: r.id,
    sku: r.sku,
    name: r.name,
    imei: null,
    snapshotQty: r.stock_qty,
    countedQty: 0,
    cost: r.cost,
  }));
}

export function summarize(lines: OpnameLineDraft[]): OpnameSummary {
  let counted = 0;
  let matched = 0;
  let shortage = 0;
  let surplus = 0;
  let varianceValue = 0;
  for (const line of lines) {
    if (line.countedQty > 0) counted++;
    const delta = computeVariance(line);
    if (delta === 0) matched++;
    else if (delta < 0) shortage++;
    else surplus++;
    varianceValue += delta * line.cost;
  }
  return { total: lines.length, counted, matched, shortage, surplus, varianceValue };
}

export function toXlsxRows(
  lines: OpnameLineDraft[],
  session: { id: string; domain: string },
): Record<string, string | number>[] {
  return lines.map((line) => ({
    Sesi: session.id,
    Domain: session.domain,
    Kode: line.sku,
    Nama: line.name,
    IMEI: line.imei ?? "",
    "Qty Sistem": line.snapshotQty,
    "Qty Fisik": line.countedQty,
    Selisih: computeVariance(line),
    "Nilai Selisih": computeVariance(line) * line.cost,
  }));
}
