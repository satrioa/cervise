"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExportCustomerRow {
  name: string;
  phone: string;
  totalServis: number;
  totalSpent: number;
  lastServis: string;
  lastStatus: string;
  lastDate: string;
  createdAt: string;
}

function csvCell(v: string | number) {
  const s = String(v).replace(/"/g, '""');
  return /[";\n]/.test(s) ? `"${s}"` : s;
}

export function ExportCustomerCsv({ rows }: { rows: ExportCustomerRow[] }) {
  const handleExport = () => {
    const header = ["Nama", "HP", "Total Servis", "Total Spent", "Servis Terakhir", "Status", "Tanggal Terakhir", "Tanggal Bergabung"];
    const lines = rows.map((r) =>
      [r.name, r.phone, r.totalServis, r.totalSpent, r.lastServis, r.lastStatus, r.lastDate, r.createdAt].map(csvCell).join(";")
    );
    const csv = "﻿" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
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
