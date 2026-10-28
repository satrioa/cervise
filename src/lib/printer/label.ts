import { code128Svg } from "@/lib/barcode/code128";
import { formatCurrencyPlain } from "@/lib/format";
import { normalizeAscii } from "./escpos";
import { printHtml } from "./transports/browserPrint";

/**
 * Label harga SKU: 50 × 25 mm, jarak antar label 1 inci.
 *
 * shortcut: selalu lewat dialog cetak browser karena protokol label printer
 * (TSPL/ZPL/ESC-POS) belum diketahui. Ganti ke byte TSPL mentah lewat
 * `transport.write` setelah merek printer label dipastikan.
 */

export const LABEL_WIDTH_MM = 50;
export const LABEL_HEIGHT_MM = 25;
export const LABEL_GAP_MM = 25.4;

export type SkuLabelInput = {
  name: string;
  /** Baris varian: storage/warna atau IMEI. */
  variant: string;
  sku: string;
  price: number | null;
};

function escapeHtml(value: string): string {
  return normalizeAscii(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Satu label HTML. */
function renderLabel(item: SkuLabelInput): string {
  const price = item.price == null ? "" : formatCurrencyPlain(item.price);
  return `<div class="label">
  <div class="name">${escapeHtml(item.name)}</div>
  ${item.variant && item.variant !== "—" ? `<div class="meta">${escapeHtml(item.variant)}</div>` : ""}
  <div class="sku">${escapeHtml(item.sku)}</div>
  ${price ? `<div class="price">${escapeHtml(price)}</div>` : ""}
  <div class="code">${code128Svg(item.sku, { height: 28, moduleWidth: 1, margin: 2 })}</div>
</div>`;
}

/** Dokumen cetak berisi seluruh label, satu label per halaman 50 × 25 mm. */
export function renderSkuLabelHtml(items: SkuLabelInput[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Label SKU</title>
<style>
  @page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM + LABEL_GAP_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #111827; }
  .label {
    width: ${LABEL_WIDTH_MM}mm;
    height: ${LABEL_HEIGHT_MM}mm;
    padding: 1.2mm 1.5mm;
    margin-bottom: ${LABEL_GAP_MM}mm;
    display: flex;
    flex-direction: column;
    gap: 0.4mm;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .name { font-size: 8pt; font-weight: 700; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 6.5pt; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sku { font-size: 6.5pt; font-family: ui-monospace, monospace; letter-spacing: .02em; }
  .price { font-size: 7.5pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .code { margin-top: auto; }
  .code svg { width: 100%; height: 7mm; display: block; }
</style>
</head><body>
${items.map(renderLabel).join("\n")}
<script>window.print();</script>
</body></html>`;
}

/** Buka dialog cetak label. Return false kalau pop-up diblokir. */
export function printSkuLabels(items: SkuLabelInput[]): boolean {
  if (items.length === 0) return false;
  return printHtml(renderSkuLabelHtml(items));
}
