"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GenericExportDialog,
  type ExportField,
} from "@/components/generic-export-dialog";

type Tx = {
  id: string;
  rawId: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  direction: "in" | "out";
  metode: string | null;
};

/**
 * `id` field di GenericExportDialog dipakai sebagai kunci baris, jadi setiap
 * field harus punya pasangan properti dengan nama yang sama. Nama header tetap
 * bebas: yang tampil di UI boleh lebih panjang dari yang ditulis ke file.
 */
const FIELDS: ExportField[] = [
  { id: "tanggal", label: "Tanggal", default: true },
  { id: "deskripsi", label: "Deskripsi", default: true },
  { id: "id", label: "ID", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "metode", label: "Metode", default: false },
  { id: "nominal", label: "Nominal", default: true },
];

export function TransaksiExportButton({ rows }: { rows: Tx[] }) {
  const [open, setOpen] = useState(false);

  const exportRows = useMemo(
    () =>
      rows.map((r) => ({
        tanggal: r.date,
        deskripsi: r.description,
        id: r.id,
        cabang: r.counterparty,
        metode: r.metode ?? "",
        nominal: String(r.amount),
      })),
    [rows],
  );

  const branchNote = useMemo(() => {
    const branches = new Set(rows.map((r) => r.counterparty));
    return branches.size === 1 ? Array.from(branches)[0] : `${branches.size} cabang`;
  }, [rows]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowDownToLineIcon className="size-4" />
        Export
      </Button>
      <GenericExportDialog
        open={open}
        onOpenChange={setOpen}
        title="Export data"
        description="Unduh transaksi dalam format pilihan."
        fields={FIELDS}
        rows={exportRows}
        fileNamePrefix="transaksi"
        sheetName="Transaksi"
        rowUnit="transaksi"
        pdfTitle="Transaksi Cervise"
        pdfNote={branchNote}
      />
    </>
  );
}