"use client";

import { DownloadIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { summarize, toXlsxRows, type OpnameLineDraft } from "@/lib/operational/stock-opname";

export function OpnameExport({
  lines,
  session,
}: {
  lines: OpnameLineDraft[];
  session: { id: string; domain: string };
}) {
  const download = () => {
    const summary = summarize(lines);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          "ID Sesi": session.id,
          Domain: session.domain,
          Total: summary.total,
          Terhitung: summary.counted,
          Cocok: summary.matched,
          Kurang: summary.shortage,
          Lebih: summary.surplus,
          "Nilai Selisih": summary.varianceValue,
        },
      ]),
      "Ringkasan",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toXlsxRows(lines, session)), "Baris");
    XLSX.writeFile(workbook, `opname-${session.domain}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={download}>
      <DownloadIcon data-icon="inline-start" />
      Ekspor XLSX
    </Button>
  );
}
