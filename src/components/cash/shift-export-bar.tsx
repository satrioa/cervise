"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  formatShiftAsText,
  formatShiftRowsForSheet,
  rupiah,
  type ShiftReport,
} from "@/lib/operational/laporan-shift";

/**
 * Ekspor Laporan Shift: PDF dan Excel satu klik, plus salin sebagai teks.
 *
 * Angka diambil dari `ShiftReport` yang sama dengan yang tampil di layar dan
 * yang tersimpan di snapshot — bukan dihitung ulang saat mengunduh. Kalau
 * snapshot yang jadi sumber, laporan yang sudah diunduh kemarin tidak berubah
 * isinya karena ada koreksi.
 *
 * PDF dibangun dari HTML yang dicetak (`window.print()`), mengikuti pola
 * `print-templates.tsx` yang sudah dipakai untuk nota servis. Tidak ada
 * dependency PDF baru.
 *
 * `load` dipakai untuk kasus laporan belum ada di memori — di tabel daftar
 * shift, snapshot diambil saat tombol ditekan. Kalau tidak diberikan, laporan
 * harus sudah ada (dipakai di dalam dialog yang menampilkannya).
 */
export function ShiftExportBar({
  report,
  load,
  size = "default",
}: {
  report?: ShiftReport | null;
  load?: () => Promise<ShiftReport | null>;
  size?: "default" | "sm";
}) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | "copy" | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const resolve = async (): Promise<ShiftReport | null> => {
    if (report) return report;
    if (!load) return null;
    return load();
  };

  const baseName = (value: ShiftReport) =>
    `laporan-shift-${value.date}-${value.employeeName}`.replace(/[^\w-]+/g, "-").toLowerCase();

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const value = await resolve();
      if (!value) return;
      const frame = frameRef.current;
      const doc = frame?.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(buildPrintHtml(value));
      doc.close();
      // Beri frame kesempatan memuat stylesheet sebelum dialog cetak dibuka.
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuat PDF");
    } finally {
      setBusy(null);
    }
  };

  const downloadExcel = async () => {
    setBusy("xlsx");
    try {
      const value = await resolve();
      if (!value) return;
      const sheet = XLSX.utils.aoa_to_sheet(formatShiftRowsForSheet(value));
      sheet["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, `Shift ${value.date}`);
      XLSX.writeFile(book, `${baseName(value)}.xlsx`);
      toast.success("Excel tersimpan");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuat Excel");
    } finally {
      setBusy(null);
    }
  };

  const copyAsText = async () => {
    setBusy("copy");
    try {
      const value = await resolve();
      if (!value) return;
      const text = formatShiftAsText(value);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Clipboard API butuh konteks aman; jalur ini tidak butuh izin apa pun.
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      toast.success("Teks laporan disalin");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal menyalin");
    } finally {
      setBusy(null);
    }
  };

  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={downloadPdf}
        disabled={busy !== null}
        title="Download PDF"
        className={`rounded-md border border-border/60 transition-colors hover:bg-foreground/[0.04] disabled:opacity-50 ${pad}`}
      >
        {busy === "pdf" ? "PDF..." : size === "sm" ? "PDF" : "Download PDF"}
      </button>
      <button
        type="button"
        onClick={downloadExcel}
        disabled={busy !== null}
        title="Download Excel"
        className={`rounded-md border border-border/60 transition-colors hover:bg-foreground/[0.04] disabled:opacity-50 ${pad}`}
      >
        {busy === "xlsx" ? "Excel..." : size === "sm" ? "Excel" : "Download Excel"}
      </button>
      <button
        type="button"
        onClick={copyAsText}
        disabled={busy !== null}
        title="Copy sebagai teks"
        className={`rounded-md border border-border/60 transition-colors hover:bg-foreground/[0.04] disabled:opacity-50 ${pad}`}
      >
        {busy === "copy" ? "Menyalin..." : size === "sm" ? "Copy" : "Copy as text"}
      </button>
      {/* Frame tersembunyi: dipakai hanya sebagai konteks cetak. */}
      <iframe ref={frameRef} title="cetak shift" className="hidden" aria-hidden />
    </div>
  );
}

/** HTML untuk dicetak. Sengaja tanpa Tailwind: iframe tidak memuat CSS app. */
function buildPrintHtml(report: ShiftReport): string {
  const rows = formatShiftRowsForSheet(report);
  const body = rows
    .map((row) => {
      if (row.length === 0) return "<tr><td colspan='4'>&nbsp;</td></tr>";
      const [first, ...rest] = row;
      return `<tr><td>${escapeHtml(String(first))}</td>${rest
        .map((cell) => `<td class="n">${escapeHtml(String(cell ?? ""))}</td>`)
        .join("")}</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan Shift ${escapeHtml(report.date)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 12px/1.5 ui-sans-serif, system-ui, sans-serif; color: #111; }
  h1 { font-size: 16px; margin: 0 0 2px; letter-spacing: .08em; }
  .meta { color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 4px; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr { border-bottom: 1px solid #eee; }
</style>
</head>
<body>
<h1>LAPORAN SHIFT</h1>
<div class="meta">${escapeHtml(report.branchName)} &middot; ${escapeHtml(report.employeeName)} &middot; ${escapeHtml(report.date)} &middot; saldo awal ${escapeHtml(rupiah(report.openingBalance))}</div>
<table>${body}</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
