"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExportSparepartRow {
  sku: string;
  name: string;
  variant: string;
  category: string;
  price: number;
  stock: number;
  capacity: number;
}

function csvCell(v: string | number) {
  const s = String(v).replace(/"/g, '""');
  return /[";\n]/.test(s) ? `"${s}"` : s;
}

export function ExportInventoryCsv({ rows }: { rows: ExportSparepartRow[] }) {
  const handleExport = () => {
    const header = ["SKU", "Nama", "Varian", "Kategori", "Harga", "Stok", "Kapasitas"];
    const lines = rows.map((r) =>
      [r.sku, r.name, r.variant, r.category, r.price, r.stock, r.capacity].map(csvCell).join(";")
    );
    const csv = "﻿" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
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
