"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExportKaryawanRow {
  name: string;
  email: string;
  cabang: string;
  role: string;
  statusAktif: string;
  terakhirAktif: string;
}

function csvCell(v: string) {
  const s = String(v).replace(/"/g, '""');
  return /[";\n]/.test(s) ? `"${s}"` : s;
}

export function ExportKaryawanCsv({ rows }: { rows: ExportKaryawanRow[] }) {
  const handleExport = () => {
    const header = ["Nama", "Email", "Cabang", "Role", "Status", "Terakhir aktif"];
    const lines = rows.map((r) =>
      [r.name, r.email, r.cabang, r.role, r.statusAktif, r.terakhirAktif].map(csvCell).join(";")
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `karyawan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleExport} disabled={rows.length === 0}>
      <DownloadIcon className="size-3.5" />
      Export
    </Button>
  );
}
