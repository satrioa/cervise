/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";
import type { RekapRow } from "./rekap";
import type { RekapSummary } from "./actions";

const FIELDS: ExportField[] = [
  { id: "tanggal", label: "Tanggal", default: true },
  { id: "nama", label: "Nama", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "jamMasuk", label: "Jam masuk", default: true },
  { id: "jamPulang", label: "Jam pulang", default: true },
  { id: "statusLabel", label: "Status", default: true },
  { id: "lokasi", label: "Lokasi", default: true },
  { id: "catatan", label: "Catatan", default: true },
];

const STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "TERLAMBAT", label: "Terlambat" },
  { value: "PULANG_AWAL", label: "Pulang awal" },
  { value: "BELUM_PULANG", label: "Belum pulang" },
];

export function RekapClient({
  month,
  cabang,
  status,
  rows,
  summary,
  branches,
}: {
  month: string;
  cabang: string;
  status: string;
  rows: RekapRow[];
  summary: RekapSummary[];
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);

  function updateFilter(key: "month" | "cabang" | "status", value: string) {
    const next = new URLSearchParams({ month, cabang, status });
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/app/laporan/absensi?${next.toString()}`);
  }

  const exportRows = rows.map((row) => ({
    tanggal: row.tanggal,
    nama: row.nama,
    cabang: row.cabang,
    jamMasuk: row.jamMasuk,
    jamPulang: row.jamPulang,
    statusLabel: row.statusLabel,
    lokasi: row.lokasi,
    catatan: row.catatan,
  }));

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Laporan Absensi"
        titleClassName="font-heading text-2xl"
        description={`Menampilkan ${rows.length} catatan absen · ${month}`}
        actions={<Button onClick={() => setExportOpen(true)}>Export</Button>}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => updateFilter("month", e.target.value)}
            className="w-40"
          />
          <Select
            value={cabang || "all"}
            onValueChange={(value) => updateFilter("cabang", value === "all" ? "" : (value ?? ""))}
          >
            <SelectTrigger className="w-48">
              <SelectValue>{branches.find((b) => b.id === cabang)?.name ?? "Semua cabang"}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="all">Semua cabang</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Select
            value={status || "all"}
            onValueChange={(value) => updateFilter("status", value === "all" ? "" : (value ?? ""))}
          >
            <SelectTrigger className="w-40">
              <SelectValue>{STATUS_OPTIONS.find((s) => s.value === status)?.label ?? "Semua status"}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="all">Semua status</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {["Tanggal", "Nama", "Cabang", "Masuk", "Pulang", "Status", "Selfie", "Lokasi", "Catatan"].map(
                  (header) => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.tanggal}</td>
                  <td className="px-3 py-2">{row.nama}</td>
                  <td className="px-3 py-2">{row.cabang}</td>
                  <td className="px-3 py-2">{row.jamMasuk}</td>
                  <td className="px-3 py-2">{row.jamPulang}</td>
                  <td className="px-3 py-2">{row.statusLabel}</td>
                  <td className="px-3 py-2">
                    {row.selfieUrl ? (
                      <img src={row.selfieUrl} alt="Selfie" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{row.lokasi}</td>
                  <td className="px-3 py-2">{row.catatan}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Belum ada absen bulan ini.</p>
          ) : null}
        </div>

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Ringkasan per karyawan</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {["Nama", "Hadir", "Terlambat", "Pulang awal", "Belum pulang"].map((header) => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((entry) => (
                  <tr key={entry.employeeId} className="border-t">
                    <td className="px-3 py-2">{entry.nama}</td>
                    <td className="px-3 py-2">{entry.hadir}</td>
                    <td className="px-3 py-2">{entry.terlambat}</td>
                    <td className="px-3 py-2">{entry.pulangAwal}</td>
                    <td className="px-3 py-2">{entry.belumPulang}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <GenericExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export rekap absensi"
        fileNamePrefix="rekap-absensi"
        sheetName="Absensi"
        fields={FIELDS}
        rows={exportRows}
        pdfTitle="Rekap Absensi"
        pdfNote={month}
      />
    </div>
  );
}
