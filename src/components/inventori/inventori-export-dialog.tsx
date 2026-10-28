"use client";

import { useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as XLSX from "xlsx";
import { FileSpreadsheetIcon, PrinterIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatCurrencyPlain } from "@/lib/format";
import { printHtml } from "@/lib/printer/transports/browserPrint";
import type { InventoryGroup } from "@/lib/operational/inventori";

/**
 * Ekspor katalog ke Excel (tiga sheet) atau PDF lewat dialog cetak browser.
 *
 * "Gadget saja" mempersempit ekspor ke dua sheet gadget; tanpa centang,
 * aksesori dan kategori lain ikut ke sheet "Aksesoris".
 */

const HEADERS = ["Nama", "SKU", "Kategori", "Tipe", "Storage", "Warna", "Stok", "Modal", "Jual", "Barcode", "IMEI", "Catatan"];

type ExportRow = {
  nama: string;
  sku: string;
  kategori: string;
  tipe: string;
  storage: string;
  warna: string;
  stok: number;
  modal: number;
  jual: number;
  barcode: string;
  imei: string;
  catatan: string;
};

function toExportRow(product: InventoryGroup["items"][number]): ExportRow {
  return {
    nama: product.name,
    sku: product.sku,
    kategori: product.category ?? "",
    tipe: product.variant_type === "BEKAS" ? "BEKAS" : "BARU",
    storage: product.storage ?? "",
    warna: product.warna ?? "",
    stok: product.stock_qty ?? 0,
    modal: product.cost ?? 0,
    jual: product.price ?? 0,
    barcode: product.barcode ?? "",
    imei: product.imei ?? "",
    catatan: product.kondisi_notes ?? "",
  };
}

function buildSheets(groups: InventoryGroup[], gadgetOnly: boolean): { name: string; rows: ExportRow[] }[] {
  const products = groups.flatMap((group) => group.items);
  const gadget = products.filter((product) => product.category === "Gadget");
  const sheets = [
    { name: "Gadget New", rows: gadget.filter((product) => product.variant_type !== "BEKAS") },
    { name: "Gadget Bekas", rows: gadget.filter((product) => product.variant_type === "BEKAS") },
  ];
  if (!gadgetOnly) {
    sheets.push({ name: "Aksesoris", rows: products.filter((product) => product.category !== "Gadget") });
  }
  return sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows.map(toExportRow) }));
}

function downloadExcel(sheets: { name: string; rows: ExportRow[] }[]) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [
      HEADERS,
      ...sheet.rows.map((row) => [row.nama, row.sku, row.kategori, row.tipe, row.storage, row.warna, row.stok, row.modal, row.jual, row.barcode, row.imei, row.catatan]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), sheet.name);
  }
  XLSX.writeFile(workbook, `inventori-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printPdf(sheets: { name: string; rows: ExportRow[] }[], gadgetOnly: boolean) {
  const body = sheets
    .map(
      (sheet) => `<h2>${escapeHtml(sheet.name)} <small>(${sheet.rows.length})</small></h2>
<table><thead><tr>${HEADERS.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>
${sheet.rows
  .map(
    (row) =>
      `<tr><td>${escapeHtml(row.nama)}</td><td class="mono">${escapeHtml(row.sku)}</td><td>${escapeHtml(row.kategori)}</td><td>${escapeHtml(row.tipe)}</td><td>${escapeHtml(row.storage)}</td><td>${escapeHtml(row.warna)}</td><td class="num">${row.stok}</td><td class="num">${formatCurrencyPlain(row.modal)}</td><td class="num">${formatCurrencyPlain(row.jual)}</td><td class="mono">${escapeHtml(row.barcode)}</td><td class="mono">${escapeHtml(row.imei)}</td><td>${escapeHtml(row.catatan)}</td></tr>`,
  )
  .join("\n")}
</tbody></table>`,
    )
    .join("\n");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Inventori</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #111827; }
  h1 { font-size: 14pt; margin: 0 0 4px; }
  h2 { font-size: 10pt; margin: 14px 0 4px; }
  p.meta { font-size: 8pt; color: #6b7280; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  th, td { border: 1px solid #d1d5db; padding: 3px 4px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; text-transform: uppercase; letter-spacing: .03em; }
  .mono { font-family: ui-monospace, monospace; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr { break-inside: avoid; }
</style></head><body>
<h1>Inventori</h1>
<p class="meta">Dicetak ${new Date().toLocaleString("id-ID")}${gadgetOnly ? " · gadget saja" : " · termasuk aksesoris"}</p>
${body}
<script>window.print();</script>
</body></html>`;

  if (!printHtml(html)) toast.error("Pop-up diblokir — izinkan pop-up untuk mencetak PDF");
}

export function InventoriExportDialog({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: InventoryGroup[];
}) {
  const [gadgetOnly, setGadgetOnly] = useState(true);
  const sheets = useMemo(() => buildSheets(groups, gadgetOnly), [groups, gadgetOnly]);
  const total = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-2xl">
          <DialogPrimitive.Title className="font-heading text-base font-semibold">Export Inventori</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
            Excel berisi sheet Gadget New / Gadget Bekas / Aksesoris. PDF dicetak lewat dialog browser.
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="export-gadget-only" checked={gadgetOnly} onCheckedChange={(checked) => setGadgetOnly(checked === true)} />
              <Label htmlFor="export-gadget-only" className="text-sm font-normal">
                Gadget saja (tanpa aksesoris)
              </Label>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {total} produk · {sheets.length} sheet
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              variant="outline"
              disabled={total === 0}
              onClick={() => printPdf(sheets, gadgetOnly)}
            >
              <PrinterIcon className="size-4" /> PDF
            </Button>
            <Button
              disabled={total === 0}
              onClick={() => {
                downloadExcel(sheets);
                onOpenChange(false);
              }}
            >
              <FileSpreadsheetIcon className="size-4" /> Unduh Excel
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
