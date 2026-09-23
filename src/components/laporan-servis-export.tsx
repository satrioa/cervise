"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";

const FIELDS: ExportField[] = [
  { id: "tanggal", label: "Tanggal", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "teknisi", label: "Teknisi", default: true },
  { id: "totalServis", label: "Total Servis", default: true },
  { id: "selesai", label: "Selesai", default: false },
  { id: "batal", label: "Batal", default: false },
];

const DUMMY = [
  { tanggal: "2026-09-21", cabang: "Cervise Pusat", teknisi: "Rudi", totalServis: 12, selesai: 8, batal: 1 },
  { tanggal: "2026-09-20", cabang: "Cervise Cabang 2", teknisi: "Sari", totalServis: 8, selesai: 5, batal: 0 },
];

export function LaporanServisExport() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)}>Export Excel</Button>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Export PDF
        </Button>
      </div>
      <GenericExportDialog
        open={open}
        onOpenChange={setOpen}
        title="Export Laporan Servis"
        description="Unduh rekap servis per tanggal/cabang/teknisi."
        fields={FIELDS}
        rows={DUMMY}
        fileNamePrefix="laporan-servis"
      />
    </>
  );
}
