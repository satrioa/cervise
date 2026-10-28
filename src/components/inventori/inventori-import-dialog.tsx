"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as XLSX from "xlsx";
import { DownloadIcon, FileSpreadsheetIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrencyPlain } from "@/lib/format";
import { importInventori } from "@/app/app/inventori/actions";
import {
  IMPORT_HEADERS,
  IMPORT_ROW_CAP,
  prepareInventoriImport,
  type InventoriImportRow,
} from "@/lib/inventori/import";
import type { InventoryGroup } from "@/lib/operational/inventori";

/**
 * Impor katalog dari Excel. Template diunduh dari aplikasi supaya header dan
 * urutan kolom selalu sama dengan yang dibaca di sini.
 */

const TEMPLATE_SAMPLE = ["iPhone 14 Pro", "GD-B-256-BL", "Gadget", "BARU", "256 GB", "Blue", "3", "15000000", "17000000", "", "", ""];

function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[...IMPORT_HEADERS], TEMPLATE_SAMPLE]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Inventori");
  XLSX.writeFile(workbook, "template-inventori.xlsx");
}

export function InventoriImportDialog({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: InventoryGroup[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoriImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const existingSkus = useMemo(
    () => groups.flatMap((group) => group.items.map((product) => product.sku)),
    [groups],
  );
  const preview = useMemo(() => prepareInventoriImport(rows, existingSkus), [rows, existingSkus]);

  const reset = () => {
    setFileName(null);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const first = workbook.SheetNames[0];
      if (!first) throw new Error("File tidak punya sheet");
      const parsed = XLSX.utils.sheet_to_json<InventoriImportRow>(workbook.Sheets[first], { defval: "" });
      setFileName(file.name);
      setRows(parsed);
    } catch (error) {
      reset();
      toast.error(error instanceof Error ? error.message : "Gagal membaca file");
    }
  };

  const submit = async () => {
    if (preview.errors.length > 0 || preview.products.length === 0) return;
    setImporting(true);
    try {
      const { inserted } = await importInventori(rows);
      toast.success(`${inserted} produk diimpor`);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal impor");
    } finally {
      setImporting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="shrink-0 border-b px-5 py-4">
            <DialogPrimitive.Title className="font-heading text-base font-semibold">Import Inventori</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
              Unduh template, isi, lalu unggah kembali. Maksimal {IMPORT_ROW_CAP} baris sekali impor.
            </DialogPrimitive.Description>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <DownloadIcon className="size-4" /> Unduh Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <UploadIcon className="size-4" /> Pilih File Excel
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              {fileName ? <span className="truncate text-xs text-muted-foreground">{fileName}</span> : null}
            </div>

            {rows.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-2 py-1">{rows.length} baris dibaca</span>
                  <span className="rounded-full border px-2 py-1">{preview.products.length} siap diimpor</span>
                  {preview.errors.length > 0 ? (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
                      {preview.errors.length} kesalahan
                    </span>
                  ) : null}
                </div>

                {preview.errors.length > 0 ? (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {preview.errors.slice(0, 50).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-2 py-1.5">Nama</th>
                          <th className="px-2 py-1.5">SKU</th>
                          <th className="px-2 py-1.5">Tipe</th>
                          <th className="px-2 py-1.5 text-right">Stok</th>
                          <th className="px-2 py-1.5 text-right">Jual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.products.slice(0, 10).map((product) => (
                          <tr key={product.sku}>
                            <td className="truncate px-2 py-1.5">{product.name}</td>
                            <td className="px-2 py-1.5 font-mono">{product.sku}</td>
                            <td className="px-2 py-1.5">{product.variant_type}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{product.stock_qty}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrencyPlain(product.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.products.length > 10 ? (
                      <p className="border-t px-2 py-1.5 text-xs text-muted-foreground">
                        Menampilkan 10 dari {preview.products.length} baris.
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <FileSpreadsheetIcon className="mx-auto mb-2 size-6" />
                Belum ada file dipilih. Gunakan template agar kolomnya cocok.
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 px-5 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={importing || rows.length === 0 || preview.errors.length > 0 || preview.products.length === 0}
              loading={importing}
            >
              Impor {preview.products.length > 0 ? preview.products.length : ""} Produk
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
