import { formatCurrencyPlain } from "@/lib/format";
import type { ShiftReport } from "@/lib/operational/laporan-shift";
import { receiptStamp } from "@/lib/sales/receipt";
import type { SalesReceiptInput } from "@/lib/sales/receipt";
import { parsePaymentNote } from "@/lib/sales/payment-note";
import type { ServiceReceiptInput } from "./types";
import {
  PAPER_COLS,
  align,
  barcode,
  centerLine,
  columns,
  line,
  normalizeAscii,
  qr,
  renderLines,
  text,
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
  if (customer.address?.trim()) lines.push(...wrap(`Alamat: ${customer.address.trim()}`));
  if (customer.phone?.trim()) lines.push(columns("No. HP", customer.phone.trim()));
  lines.push(columns("Teknisi", safe(input.teknisi)));

  lines.push(line());
  lines.push(...wrap(pipeSeparated(service.device, service.merk, service.tipe)));
  if (service.complaint?.trim()) {
    lines.push(line("-"));
    lines.push("Keluhan:");
    lines.push(...wrap(service.complaint));
  }
  if (!service.isEstimate && service.sparepart?.trim()) {
    lines.push("Sparepart:");
    lines.push(...wrap(service.sparepart));
  }
  lines.push(columns("Status", safe(service.status)));

  lines.push(line());
  const price = service.price === null || !Number.isFinite(service.price) ? EM_DASH : formatCurrencyPlain(service.price);
  lines.push(columns(service.isEstimate ? "ESTIMASI" : "TOTAL", price));

  if (service.garansiSampai?.trim()) {
    lines.push(line());
    lines.push(columns("Garansi s/d", service.garansiSampai.trim()));
  }

  lines.push(line());
  lines.push(centerLine("Simpan Nota ini untuk pengambilan device"));
  lines.push(centerLine("Terima Kasih"));
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
  const after: number[] = [];
  if (options.trackingUrl) {
    after.push(
      ...align("center"),
      ...qr(options.trackingUrl),
      ...text(centerLine("Scan QR Code di atas untuk pantau progres servis")),
      ...align("left"),
      ...text(line()),
    );
  }
  after.push(...align("center"), ...barcode(input.invoiceNo), ...text(centerLine(input.invoiceNo)), ...align("left"));
  return renderLines(buildServiceReceiptLines(input), {
    boldLine: (row) => row.startsWith("TOTAL") || row.startsWith("ESTIMASI"),
    afterLines: after,
    cut: options.cut,
  });
}

/* ------------------------------------------------------- ringkasan shift --- */

function wibDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${day} ${time}`;
}

function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}j ${total % 60}m`;
}

/**
 * Struk ringkasan shift 58mm. Isinya sengaja lebih lengkap dari tampilan
 * dialog: struk adalah catatan laci, jadi siapa membuka/menutup, berapa lama,
 * sparepart apa yang terpakai, dan hitungan status servis ikut tercetak.
 */
export function buildShiftReceiptLines(report: ShiftReport): string[] {
  const lines: string[] = [centerLine(safe(report.branchName, "Toko").toUpperCase(), 16)];

  lines.push(columns("Open Shift", wibDateTime(report.openAt)));
  lines.push(columns("Open By", safe(report.employeeName)));
  lines.push(columns("Close Shift", wibDateTime(report.closingAt)));
  lines.push(columns("Close By", safe(report.closedByName)));
  lines.push(columns("Total Duration", durationText(report.durationMinutes ?? 0)));
  lines.push(line());

  const spareparts = report.spareparts ?? [];
  if (spareparts.length > 0) {
    lines.push("Sparepart terpakai");
    for (const part of spareparts) {
      lines.push(columns(`  ${safe(part.name)}`, `x${part.qty}`));
    }
    lines.push(line());
  }

  const stats = report.serviceStats ?? {
    masuk: report.services.length,
    selesai: 0,
    diambil: 0,
    batal: 0,
  };
  lines.push(columns("Servis Masuk", String(stats.masuk)));
  if (stats.selesai > 0) lines.push(columns("Servis Selesai", String(stats.selesai)));
  if (stats.diambil > 0) lines.push(columns("Diambil", String(stats.diambil)));
  if (stats.batal > 0) lines.push(columns("Batal", String(stats.batal)));
  lines.push(line());

  lines.push(columns("Saldo awal", formatCurrencyPlain(report.openingBalance)));
  lines.push(columns(`Servis (${report.services.length})`, formatCurrencyPlain(report.totals.services)));
  lines.push(columns(`Penjualan (${report.sales.length})`, formatCurrencyPlain(report.totals.sales)));
  lines.push(columns("Kas manual", formatCurrencyPlain(report.totals.manualNet)));
  lines.push(line());
  lines.push(columns("Harus ada", formatCurrencyPlain(report.expectedCash)));
  lines.push(
    columns(
      "Saldo akhir",
      report.closingBalance === null ? EM_DASH : formatCurrencyPlain(report.closingBalance),
    ),
  );
  lines.push(
    columns("Selisih", report.variance === null ? EM_DASH : formatCurrencyPlain(report.variance)),
  );
  if (report.reason?.trim()) lines.push(...wrap(`Catatan: ${report.reason.trim()}`));
  lines.push(line());
  lines.push(centerLine(`Dicetak ${wibDateTime(new Date().toISOString())}`));
  return lines;
}

export function buildShiftEscpos(
  report: ShiftReport,
  options: { cut?: boolean } = {},
): Uint8Array {
  return renderLines(buildShiftReceiptLines(report), {
    boldLine: (row) => row.startsWith("Harus ada") || row.startsWith("Selisih"),
    cut: options.cut,
  });
}
