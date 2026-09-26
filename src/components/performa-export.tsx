"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";

const FIELDS: ExportField[] = [
  { id: "name", label: "Teknisi", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "selesai", label: "Selesai", default: true },
  { id: "revenue", label: "Pendapatan", default: true },
  { id: "insentif", label: "Aturan insentif", default: true },
  { id: "totalInsentif", label: "Total insentif", default: true },
];

export function PerformaExport({ rows }: { rows: Record<string, string | number>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export CSV
      </Button>
      <GenericExportDialog
        open={open}
        onOpenChange={setOpen}
        title="Export Performa Teknisi"
        description="Unduh metrik teknisi."
        fields={FIELDS}
        rows={rows}
        fileNamePrefix="performa-teknisi"
      />
    </>
  );
}
