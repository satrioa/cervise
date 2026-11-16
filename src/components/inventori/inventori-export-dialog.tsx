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
 * Ekspor katalog ke Excel/PDF (4 sheet: Baru, Bekas, Aksesori, Lainnya).
 * "Gadget saja" hanya menyertakan sheet Baru & Bekas.
 */

const HEADERS = ["Nama", "SKU", "Kategori", "Tipe", "Storage", "Warna", "Stok", "Modal", "Jual", "Barcode", "IMEI", "BH %", "Garansi (hari)", "Catatan"];

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
  bh: number | "";
  garansi_hari: number | "";
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
    bh: (product as any).bh_percent ?? "",
    garansi_hari: (product as any).garansi_days ?? "",
    catatan: (product as any).kondisi_notes ?? "",
  };
}

function buildSheets(groups: InventoryGroup[], gadgetOnly: boolean): { name: string; rows: ExportRow[] }[] {
  const products = groups.flatMap((group) => group.items);
  const sheets = [
    { name: "Baru", rows: products.filter((p) => p.category === "Gadget" && p.variant_type !== "BEKAS") },
    { name: "Bekas", rows: products.filter((p) => p.variant_type === "BEKAS") },
  ];
  if (!gadgetOnly) {
    sheets.push({ name: "Aksesori", rows: products.filter((p) => p.category === "Aksesori" && p.variant_type !== "BEKAS") });
    sheets.push({ name: "Lainnya", rows: products.filter((p) => p.category === "Lainnya" && p.variant_type !== "BEKAS") });
  }
  return sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows.map(toExportRow) }));
}

function downloadExcel(sheets: { name: string; rows: ExportRow[] }[]) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [
      HEADERS,
      ...sheet.rows.map((row) => [row.nama, row.sku, row.kategori, row.tipe, row.storage, row.warna, row.stok, row.modal, row.jual, row.barcode, row.imei, row.bh, row.garansi_hari, row.catatan]),
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
      `<tr><td>${escapeHtml(row.nama)}</td><td class="mono">${escapeHtml(row.sku)}</td><td>${escapeHtml(row.kategori)}</td><td>${escapeHtml(row.tipe)}</td><td>${escapeHtml(row.storage)}</td><td>${escapeHtml(row.warna)}</td><td class="num">${row.stok}</td><td class="num">${formatCurrencyPlain(row.modal)}</td><td class="num">${formatCurrencyPlain(row.jual)}</td><td class="mono">${escapeHtml(row.barcode)}</td><td class="mono">${escapeHtml(row.imei)}</td><td class="num">${row.bh}</td><td class="num">${row.garansi_hari}</td><td>${escapeHtml(row.catatan)}</td></tr>`,
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
<p class="meta">Dicetak ${new Date().toLocaleString("id-ID")}${gadgetOnly ? " · gadget saja (Baru & Bekas)" : " · Baru, Bekas, Aksesori, Lainnya"}</p>
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
            Excel/PDF berisi 4 sheet: Baru, Bekas, Aksesori, Lainnya.
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="export-gadget-only" checked={gadgetOnly} onCheckedChange={(checked) => setGadgetOnly(checked === true)} />
              <Label htmlFor="export-gadget-only" className="text-sm font-normal">
                Gadget saja (Baru & Bekas)
              </Label>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {total} produk · {sheets.length} sheet
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {sheets.map((s) => <span key={s.name}>{s.name}: {s.rows.length}</span>)}
              </div>
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
