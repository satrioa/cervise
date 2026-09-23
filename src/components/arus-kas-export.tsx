"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";

const ARUS_KAS_FIELDS: ExportField[] = [
  { id: "date", label: "Tanggal", default: true },
  { id: "masuk", label: "Masuk", default: true },
  { id: "keluar", label: "Keluar", default: true },
  { id: "net", label: "Net", default: true },
  { id: "status", label: "Status", default: false },
];

export function ArusKasExport({ rows }: { rows: Record<string, any>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export
      </Button>
      <GenericExportDialog
        open={open}
        onOpenChange={setOpen}
        title="Export Arus Kas"
        description="Unduh rekap arus kas."
        fields={ARUS_KAS_FIELDS}
        rows={rows}
        fileNamePrefix="arus-kas"
      />
    </>
  );
}
