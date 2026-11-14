import { code128Svg } from "@/lib/barcode/code128";
import { align, barcode, feed, init, normalizeAscii, text, wrap } from "./escpos";
import { printHtml } from "./transports/browserPrint";

/**
 * Label harga SKU.
 * - Preview HTML: 50 × 25 mm, jarak antar label 1 inci.
 * - Cetak langsung: ESC/POS ke printer termal yang terhubung (best-effort).
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

/** Satu label HTML. Harga sengaja tidak dicetak; teks rata tengah. */
function renderLabel(item: SkuLabelInput): string {
  const variant = item.variant && item.variant !== "\u2014" ? item.variant : "";
  return `<div class="label">
  <div class="name">${escapeHtml(item.name)}</div>
  ${variant ? `<div class="meta">${escapeHtml(variant)}</div>` : ""}
  <div class="code">${code128Svg(item.sku, { height: 44, moduleWidth: 2 })}</div>
  <div class="sku">${escapeHtml(item.sku)}</div>
</div>`;
}

/** Dokumen cetak berisi seluruh label, satu label per halaman 50 × 25 mm. */
export function renderSkuLabelHtml(items: SkuLabelInput[], autoPrint = true): string {
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
    text-align: center;
  }
  .name { font-size: 8pt; font-weight: 700; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 6.5pt; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .code { margin-top: auto; display: flex; justify-content: center; overflow: hidden; }
  .code svg { max-width: 100%; height: 8mm; width: auto; display: block; margin: 0 auto; }
  .sku { font-size: 6.5pt; font-family: ui-monospace, monospace; letter-spacing: .02em; }
</style>
</head><body>
${items.map(renderLabel).join("\n")}
${autoPrint ? "<script>window.print();</script>" : ""}
</body></html>`;
}

/** Buka dialog cetak label (browser). Dipertahankan untuk fallback lama. */
export function printSkuLabels(items: SkuLabelInput[]): boolean {
  if (items.length === 0) return false;
  return printHtml(renderSkuLabelHtml(items));
}

/** Byte ESC/POS untuk cetak label ke printer termal terhubung (best-effort). */
export function buildSkuLabelEscpos(items: SkuLabelInput[]): Uint8Array {
  const bytes: number[] = [...init()];
  items.forEach((item, index) => {
    // Pakai perintah align printer (bukan padding spasi) agar tetap tengah di lebar kertas aktual.
    bytes.push(...align("center"));
    for (const row of wrap(item.name, 32).slice(0, 2)) bytes.push(...text(row));
    const variant = item.variant && item.variant !== "\u2014" ? item.variant : "";
    if (variant) for (const row of wrap(variant, 32).slice(0, 1)) bytes.push(...text(row));
    if (item.sku) {
      bytes.push(...barcode(item.sku, { hri: "none" }));
      bytes.push(...text(item.sku.slice(0, 32)));
    }
    bytes.push(...align("left"));
    if (index < items.length - 1) bytes.push(...feed(3));
  });
  bytes.push(...feed(4));
  return Uint8Array.from(bytes);
}
