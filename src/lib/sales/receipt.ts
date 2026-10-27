import { formatCurrencyPlain } from "@/lib/format";
import { parsePaymentNote } from "@/lib/sales/payment-note";

/**
 * Nota penjualan untuk layar dan cetak.
 *
 * Satu sumber HTML dipakai preview (iframe) dan Cetak Nota, jadi angka di
 * layar tidak mungkin berbeda dari yang tercetak. Tanpa PB1 dan QR: penjualan
 * tidak menyimpan pajak dan belum ada halaman lacak untuk nota penjualan.
 *
 * Berat font minimal 500. Bobot tipis (300/400) hilang di printer thermal dan
 * dot matrix, dan nota ini memang dibaca di kertas, bukan di layar.
 */

export type SalesReceiptItem = {
  name: string;
  sku?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  qty_returned?: number | null;
};

export type SalesReceiptInput = {
  context: {
    brandName?: string | null;
    tagline?: string | null;
    logoUrl?: string | null;
    branchName?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  sale: {
    sale_number: string;
    created_at?: string | null;
    payment_method?: string | null;
    subtotal: number;
    discount_total: number;
    total: number;
    returned_value?: number | null;
    /** Menyimpan detail pembayaran; lihat lib/sales/payment-note. */
    notes?: string | null;
  };
  customer?: { name?: string | null; phone?: string | null } | null;
  cashier?: string | null;
  items: SalesReceiptItem[];
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Tanggal & jam nota dalam WIB, apa pun zona waktu mesin kasir. */
export function receiptStamp(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
}

function row(label: string, value: string, extraClass = ""): string {
  return `<div class="row${extraClass}"><span class="label">${escapeHtml(label)}</span><span class="colon">:</span><span class="value">${value}</span></div>`;
}

export function buildSalesReceiptHtml(input: SalesReceiptInput): string {
  const { context, sale, customer, items } = input;
  const brand = context.brandName?.trim() || context.branchName?.trim() || "Nota Penjualan";
  // Nama cabang tidak diulang: alamatnya sudah menyebut kota, jadi cukup
  // alamat satu baris dan nomor telepon di baris berikutnya.
  const alamat = context.address?.trim() ?? "";
  const telepon = context.phone?.trim() ?? "";

  const itemHtml = items
    .map((item) => {
      const returned = Number(item.qty_returned ?? 0);
      return `<div class="item">
        <div class="name">${escapeHtml(item.name)}</div>
        ${item.sku ? `<div class="sku">${escapeHtml(item.sku)}</div>` : ""}
        <div class="line">
          <span class="qty">${Number(item.qty)} × ${escapeHtml(formatCurrencyPlain(Number(item.unit_price)))}${returned > 0 ? ` · retur ${returned}` : ""}</span>
          <span class="amount">${escapeHtml(formatCurrencyPlain(Number(item.line_total)))}</span>
        </div>
      </div>`;
    })
    .join("");

  const returned = Number(sale.returned_value ?? 0);
  const payment = parsePaymentNote(sale.notes);
  // Detail pembayaran dicetak tepat di bawah Grand Total: kasir perlu melihat
  // uang diterima dan kembalian saat menyerahkan nota.
  const paymentRows =
    payment.cashReceived !== undefined
      ? `<div class="row"><span>Tunai Diterima</span><span class="value">${escapeHtml(formatCurrencyPlain(payment.cashReceived))}</span></div>
    <div class="row"><span>Kembali</span><span class="value">${escapeHtml(formatCurrencyPlain(Number(payment.change ?? 0)))}</span></div>`
      : payment.detail
        ? `<div class="row"><span>Detail</span><span class="value">${escapeHtml(payment.detail)}</span></div>`
        : "";
  const meta = [
    row("No. Nota", escapeHtml(sale.sale_number)),
    row("Tanggal", escapeHtml(receiptStamp(sale.created_at))),
    row("Kasir", escapeHtml(input.cashier?.trim() || "—")),
    row("Customer", escapeHtml(customer?.name?.trim() || "—")),
    ...(customer?.phone?.trim() ? [row("No. HP", escapeHtml(customer.phone.trim()))] : []),
  ].join("");

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Nota ${escapeHtml(sale.sale_number)}</title>
<style>
  @page { margin: 6mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 12px 12px; background: #fff; color: #111827;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif;
    font-weight: 500;
  }
  .nota { width: 100%; max-width: 460px; margin: 0 auto; }
  .brand { text-align: center; }
  .brand .logo { display: block; max-height: 56px; max-width: 160px; margin: 0 auto 8px; object-fit: contain; }
  .brand h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
  .brand .tagline { margin: 5px 0 0; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #4b5563; }
  .brand .branch { margin: 8px 0 0; font-size: 10.5px; font-weight: 500; color: #374151; line-height: 1.45; }
  .meta { margin-top: 14px; font-size: 11.5px; }
  .meta .row { display: flex; gap: 6px; padding: 1.5px 0; }
  .meta .label { width: 76px; flex: none; color: #4b5563; }
  .meta .value { font-weight: 600; }
  hr.sep { border: 0; border-top: 1.5px dashed #9ca3af; margin: 12px 0; }
  .item { font-size: 12px; }
  .item + .item { margin-top: 8px; }
  .item .name { font-weight: 600; }
  .item .sku { font-size: 10px; color: #6b7280; }
  .item .line { display: flex; justify-content: space-between; gap: 8px; margin-top: 2px; }
  .item .qty { color: #374151; }
  .amount, .totals .value { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-top: 10px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
  .totals .row.grand { margin-top: 4px; border-top: 1.5px solid #111827; padding-top: 6px; font-size: 14px; font-weight: 700; }
  .footer { margin-top: 16px; text-align: center; font-size: 11.5px; font-weight: 500; color: #374151; }
  @media print { body { padding: 0; } }
</style></head>
<body><div class="nota">
  <div class="brand">
    ${context.logoUrl?.trim() ? `<img class="logo" src="${escapeHtml(context.logoUrl.trim())}" alt="">` : ""}
    <h1>${escapeHtml(brand)}</h1>
    ${context.tagline?.trim() ? `<p class="tagline">${escapeHtml(context.tagline.trim())}</p>` : ""}
    ${alamat || telepon ? `<p class="branch">${[alamat, telepon].filter(Boolean).map((v) => escapeHtml(v)).join("<br>")}</p>` : ""}
  </div>
  <div class="meta">${meta}</div>
  <hr class="sep">
  <div class="items">${itemHtml}</div>
  <hr class="sep">
  <div class="totals">
    <div class="row"><span>Subtotal</span><span class="value">${escapeHtml(formatCurrencyPlain(Number(sale.subtotal)))}</span></div>
    <div class="row"><span>Diskon Promo</span><span class="value">${escapeHtml(formatCurrencyPlain(Number(sale.discount_total)))}</span></div>
    <div class="row"><span>Metode</span><span class="value">${escapeHtml(sale.payment_method?.trim() || "—")}</span></div>
    <div class="row grand"><span>Grand Total</span><span class="value">${escapeHtml(formatCurrencyPlain(Number(sale.total)))}</span></div>
    ${paymentRows}
    ${returned > 0 ? `<div class="row"><span>Diretur</span><span class="value">${escapeHtml(formatCurrencyPlain(returned))}</span></div>` : ""}
  </div>
  <div class="footer">~Terima kasih sudah berbelanja~</div>
</div></body></html>`;
}

