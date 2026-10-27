import { formatCurrencyPlain } from "@/lib/format";
import { receiptStamp } from "@/lib/sales/receipt";
import type { SalesReceiptInput } from "@/lib/sales/receipt";
import { parsePaymentNote } from "@/lib/sales/payment-note";
import type { ServiceReceiptInput } from "./types";
import {
  PAPER_COLS,
  align,
  centerLine,
  columns,
  line,
  normalizeAscii,
  qr,
  renderLines,
  wrap,
  type EscposRaster,
} from "./escpos";

/**
 * Layout nota 58mm untuk dua jenis transaksi:
 * - penjualan: tanpa QR (belum ada halaman lacak penjualan);
 * - servis: QR native berisi URL lacak publik.
 *
 * Baris pertama dipusatkan pada 16 kolom karena dicetak ukuran ganda (32
 * kolom). Perataan lain memakai spasi supaya sama di semua printer.
 */

const EM_DASH = "-";

function safe(value: string | null | undefined, fallback = EM_DASH): string {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? fallback : normalizeAscii(trimmed);
}

function pipeSeparated(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => safe(part, "")).filter(Boolean).join(" - ");
}

export function buildSaleReceiptLines(input: SalesReceiptInput): string[] {
  const { context, sale, customer, items } = input;
  const brand = context.brandName?.trim() || context.branchName?.trim() || "Nota Penjualan";
  const lines: string[] = [centerLine(brand.toUpperCase(), 16)];

  if (context.tagline?.trim()) lines.push(centerLine(context.tagline.trim().toUpperCase()));
  if (context.address?.trim()) lines.push(...wrap(context.address.trim()).map((row) => centerLine(row)));
  if (context.phone?.trim()) lines.push(centerLine(context.phone.trim()));

  lines.push(line());
  lines.push(columns("No. Nota", sale.sale_number));
  lines.push(columns("Tanggal", receiptStamp(sale.created_at)));
  lines.push(columns("Kasir", safe(input.cashier)));
  lines.push(columns("Customer", safe(customer?.name)));
  if (customer?.phone?.trim()) lines.push(columns("No. HP", customer.phone.trim()));

  lines.push(line());
  for (const item of items) {
    lines.push(...wrap(item.name));
    if (item.sku) lines.push(normalizeAscii(item.sku).slice(0, PAPER_COLS));
    lines.push(
      columns(
        `${Number(item.qty)} x ${formatCurrencyPlain(Number(item.unit_price))}`,
        formatCurrencyPlain(Number(item.line_total)),
      ),
    );
    const returnedQty = Number(item.qty_returned ?? 0);
    if (returnedQty > 0) lines.push(`  retur ${returnedQty}`);
  }

  lines.push(line());
  lines.push(columns("Subtotal", formatCurrencyPlain(Number(sale.subtotal))));
  lines.push(columns("Diskon Promo", formatCurrencyPlain(Number(sale.discount_total))));
  lines.push(columns("Metode", safe(sale.payment_method)));
  lines.push(columns("GRAND TOTAL", formatCurrencyPlain(Number(sale.total))));

  const payment = parsePaymentNote(sale.notes);
  if (payment.cashReceived !== undefined) {
    lines.push(columns("Tunai Diterima", formatCurrencyPlain(payment.cashReceived)));
    lines.push(columns("Kembali", formatCurrencyPlain(Number(payment.change ?? 0))));
  } else if (payment.detail) {
    lines.push(...wrap(`Detail: ${payment.detail}`));
  }

  const returnedValue = Number(sale.returned_value ?? 0);
  if (returnedValue > 0) lines.push(columns("Diretur", formatCurrencyPlain(returnedValue)));

  lines.push(line());
  lines.push(centerLine("~Terima kasih sudah berbelanja~"));
  return lines;
}

export function buildServiceReceiptLines(input: ServiceReceiptInput): string[] {
  const { branch, service, customer } = input;
  const lines: string[] = [centerLine(safe(branch.name, "Nota Servis").toUpperCase(), 16)];

  if (branch.address?.trim()) lines.push(...wrap(branch.address.trim()).map((row) => centerLine(row)));
  if (branch.phone?.trim()) lines.push(centerLine(branch.phone.trim()));

  lines.push(line());
  lines.push(columns("No. Servis", input.invoiceNo));
  lines.push(columns("Tanggal", input.printTime));
  lines.push(columns("Pelanggan", safe(customer.name)));
  if (customer.phone?.trim()) lines.push(columns("No. HP", customer.phone.trim()));
  lines.push(columns("Teknisi", safe(input.teknisi)));

  lines.push(line());
  lines.push(...wrap(pipeSeparated(service.device, service.merk, service.tipe)));
  if (service.complaint?.trim()) {
    lines.push(line("-"));
    lines.push("Keluhan:");
    lines.push(...wrap(service.complaint));
  }
  if (service.sparepart?.trim()) {
    lines.push("Sparepart:");
    lines.push(...wrap(service.sparepart));
  }
  lines.push(columns("Status", safe(service.status)));

  lines.push(line());
  const price = service.price === null || !Number.isFinite(service.price) ? EM_DASH : formatCurrencyPlain(service.price);
  lines.push(columns("TOTAL", price));

  if (service.garansiSampai?.trim()) {
    lines.push(line());
    lines.push(columns("Garansi s/d", service.garansiSampai.trim()));
  }

  lines.push(line());
  lines.push(centerLine("Simpan nota ini sebagai bukti garansi"));
  lines.push(centerLine("Terima kasih"));
  return lines;
}

export function buildSaleEscpos(
  input: SalesReceiptInput,
  options: { logo?: EscposRaster | null; cut?: boolean } = {},
): Uint8Array {
  return renderLines(buildSaleReceiptLines(input), {
    logo: options.logo,
    boldLine: (row) => row.startsWith("GRAND TOTAL"),
    cut: options.cut,
  });
}

export function buildServiceEscpos(
  input: ServiceReceiptInput,
  options: { trackingUrl?: string | null; cut?: boolean } = {},
): Uint8Array {
  const qrCommand = options.trackingUrl ? [...align("center"), ...qr(options.trackingUrl)] : undefined;
  return renderLines(buildServiceReceiptLines(input), {
    boldLine: (row) => row.startsWith("TOTAL"),
    afterLines: qrCommand,
    cut: options.cut,
  });
}
