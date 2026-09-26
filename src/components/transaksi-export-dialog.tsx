"use client";

import { useState, useMemo } from "react";
import { CalendarIcon, DownloadIcon, FileJsonIcon, FileSpreadsheetIcon, FileTextIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Format = "csv" | "xlsx" | "json" | "pdf";

const FORMATS: { id: Format; label: string; meta: string; Icon: typeof FileTextIcon }[] = [
  { id: "csv", label: "CSV", meta: "Spreadsheet · 7 kolom", Icon: FileSpreadsheetIcon },
  { id: "xlsx", label: "Excel", meta: "XLSX · terformat", Icon: FileSpreadsheetIcon },
  { id: "json", label: "JSON", meta: "Raw, dengan metadata", Icon: FileJsonIcon },
  { id: "pdf", label: "PDF", meta: "Laporan cetak", Icon: FileTextIcon },
];

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

const INCLUDE_FIELDS = [
  { id: "tanggal", label: "Tanggal", default: true },
  { id: "deskripsi", label: "Deskripsi", default: true },
  { id: "id", label: "ID Transaksi", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "metode", label: "Metode", default: false },
  { id: "nominal", label: "Nominal", default: true },
] as const;

export function TransaksiExportDialog({
  open,
  onOpenChange,
  rows,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: Tx[];
}) {
  const [fileFormat, setFileFormat] = useState<Format>("csv");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [include, setInclude] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INCLUDE_FIELDS.map((f) => [f.id, f.default]))
  );

  const filteredRows = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return rows;
    // For demo, just return rows (real would filter by kas_date)
    return rows;
  }, [rows, dateRange]);

  const toggleInclude = (id: string, checked: boolean) => {
    setInclude((prev) => ({ ...prev, [id]: checked }));
  };

  const handleExport = () => {
    const fields = INCLUDE_FIELDS.filter((f) => include[f.id]);
    const headers = fields.map((f) => f.label);
    const data = filteredRows.map((r) => {
      const row: Record<string, string> = {};
      if (include.tanggal) row["Tanggal"] = r.date;
      if (include.deskripsi) row["Deskripsi"] = r.description;
      if (include.id) row["ID"] = r.id;
      if (include.cabang) row["Cabang"] = r.counterparty;
      if (include.metode) row["Metode"] = r.metode ?? "";
      if (include.nominal) row["Nominal"] = String(r.amount);
      return row;
    });

    const baseName = `transaksi-${format(new Date(), "yyyy-MM-dd")}`;

    if (fileFormat === "csv") {
      const header = headers.join(";");
      const csvRows = data.map((row) => headers.map((h) => csvCell(String(row[h] ?? ""))).join(";"));
      const csv = "\uFEFF" + [header, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (fileFormat === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    } else if (fileFormat === "json") {
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), count: data.length, rows: data }, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (fileFormat === "pdf") {
      const w = window.open("", "_blank");
      if (!w) return;
      const rowsHtml = data
        .map(
          (row) => `
        <tr>
          ${headers.map((h) => `<td>${String(row[h] ?? "")}</td>`).join("")}
        </tr>
      `
        )
        .join("");
      w.document.write(`
        <html><head><meta charset="utf-8"><title>${baseName}</title>
        <style>
          body{font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color:#111827; padding: 20px;}
          h1{font-size: 16pt; margin:0 0 4px;}
          .meta{font-size: 9pt; color:#6b7280; margin-bottom: 12px;}
          table{width:100%; border-collapse:collapse; font-size: 9pt;}
          th{background:#111827; color:#fff; padding:6px 8px; text-align:left; font-size:8pt; text-transform:uppercase;}
          td{border:1px solid #e5e7eb; padding:6px 8px;}
          td:last-child{text-align:right; font-family: monospace;}
        </style>
        </head><body>
          <h1>Transaksi Cervise</h1>
          <div class="meta">${format(new Date(), "d MMM yyyy", { locale: localeId })} · ${data.length} transaksi · ${branchLabel()}</div>
          <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>
          <script>window.print();</script>
        </body></html>
      `);
      w.document.close();
    }

    onOpenChange(false);
  };

  const branchLabel = () => {
    const branches = new Set(filteredRows.map((r) => r.counterparty));
    if (branches.size === 1) return Array.from(branches)[0];
    return `${branches.size} cabang`;
  };

  const estimatedSize = useMemo(() => {
    const base = filteredRows.length * 120; // rough bytes per row
    if (fileFormat === "pdf") return `~${Math.max(1, Math.round(base / 1024))} KB`;
    if (fileFormat === "xlsx") return `~${Math.max(1, Math.round((base * 1.2) / 1024))} KB`;
    return `~${Math.max(1, Math.round(base / 1024))} KB`;
  }, [filteredRows.length, fileFormat]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>Export data</DialogTitle>
          <DialogDescription>Unduh transaksi dalam format pilihan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Format</div>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => {
                const active = fileFormat === f.id;
                return (
                  <label
                    key={f.id}
                    className={
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors " +
                      (active ? "border-foreground/60 bg-foreground/[0.04]" : "border-border/60 hover:border-foreground/30")
                    }
                  >
                    <input type="radio" className="sr-only" checked={active} onChange={() => setFileFormat(f.id)} />
                    <span className={"size-3.5 rounded-full border shrink-0 " + (active ? "border-foreground bg-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background" : "border-border")} />
                    <f.Icon className="size-4 opacity-70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-none">{f.label}</div>
                      <div className="text-muted-foreground text-xs leading-tight truncate">{f.meta}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Rentang tanggal</div>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm hover:bg-accent/50"
                  />
                }
              >
                <CalendarIcon className="size-4 opacity-60" />
                <span className="flex-1 truncate">
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from, "d MMM", { locale: localeId })} – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`
                    : dateRange.from
                      ? format(dateRange.from, "d MMM yyyy", { locale: localeId })
                      : "Pilih rentang tanggal"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {dateRange.from || dateRange.to ? `${filteredRows.length} transaksi` : "Semua"}
                </span>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => {
                    if (!range) setDateRange({});
                    else setDateRange({ from: range.from, to: range.to });
                  }}
                  numberOfMonths={1}
                />
                <div className="flex justify-between border-t p-2">
                  <Button variant="ghost" size="xs" onClick={() => setDateRange({})}>
                    Reset
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => {}}>
                    Hari ini
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Sertakan</div>
            <div className="grid grid-cols-2 gap-1.5">
              {INCLUDE_FIELDS.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-foreground/[0.03] has-[[data-state=checked]]:border-border/60 has-[[data-state=checked]]:bg-foreground/[0.02]">
                  <Checkbox checked={!!include[f.id]} onCheckedChange={(v) => toggleInclude(f.id, !!v)} />
                  <span className="text-sm leading-none">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
          <span className="text-muted-foreground text-xs">Estimasi · {estimatedSize} · {filteredRows.length} baris</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleExport}>
              <DownloadIcon className="size-4" />
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function csvCell(v: string): string {
  if (v.includes('"') || v.includes(";") || v.includes("\n") || v.includes(",")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
