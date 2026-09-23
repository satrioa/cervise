"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";
import { DownloadIcon } from "lucide-react";

const FIELDS: ExportField[] = [
  { id: "tanggal", label: "Tanggal", default: true },
  { id: "deskripsi", label: "Deskripsi", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "tipe", label: "Tipe", default: true },
  { id: "nominal", label: "Nominal", default: true },
  { id: "metode", label: "Metode", default: false },
];

export function LaporanKeuanganExport({ rows }: { rows: Record<string, any>[] }) {
  const [open, setOpen] = useState(false);
  // fallback dummy if no rows
  const data =
    rows.length > 0
      ? rows
      : [
          { tanggal: "2026-09-21", deskripsi: "Servis SV-1001", cabang: "Cervise Pusat", tipe: "pemasukan", nominal: 450000, metode: "Tunai" },
          { tanggal: "2026-09-20", deskripsi: "Beli sparepart", cabang: "Cervise Pusat", tipe: "pengeluaran", nominal: 200000, metode: "Transfer" },
        ];
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <DownloadIcon className="size-3.5" /> Export
      </Button>
      <GenericExportDialog
        open={open}
        onOpenChange={setOpen}
        title="Export Laporan Keuangan"
        description="Unduh rekap keuangan per cabang."
        fields={FIELDS}
        rows={data}
        fileNamePrefix="laporan-keuangan"
      />
    </>
  );
}
