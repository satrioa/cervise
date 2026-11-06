"use client";

import { useState } from "react";
import {
  ChevronRightIcon,
  PackageIcon,
  PrinterIcon,
  ShoppingCartIcon,
  WalletIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import {
  shiftBreakdown,
  shiftClock,
  shiftDateLabel,
  shiftDuration,
} from "@/lib/operational/shift-detail";
import { cn } from "@/lib/utils";
import { printShiftReport } from "./shift-thermal-print";
import { VarianceRow } from "./shift-report";

/** Baris per daftar sebelum "+N lainnya". Dialog tidak boleh melompat tinggi. */
const PREVIEW_ROWS = 4;

type LedgerRow = {
  id: string;
  label: string;
  note?: string;
  value: string;
  muted?: boolean;
};

/**
 * Detail operasional satu shift: informasi, transaksi, dan angka laci.
 *
 * Beda dengan `ShiftReportView` yang berupa dokumen (dipakai preview Tutup Toko
 * dan Laporan Shift), dialog ini menyusun angka yang sama sebagai tiga kolom
 * supaya bisa dipakai sambil bekerja: kolom kiri "shift ini apa", tengah "uang
 * datang dari mana", kanan "yang harus ada di laci" + aksi.
 *
 * `onCloseShop` hanya dipanggil saat shift masih terbuka. Pemanggil yang
 * menutup dialog ini lalu membuka `ClosingDialog` — jangan menumpuk dua modal.
 */
export function ShiftDetailDialog({
  open,
  onOpenChange,
  report,
  title,
  onCloseShop,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  report: ShiftReport;
  title: string;
  onCloseShop?: () => void;
}) {
  const shiftOpen = report.closingBalance === null;
  const duration = shiftDuration(report.durationMinutes);
  const stats = report.serviceStats;

  const services: LedgerRow[] = report.services.map((line) => ({
    id: line.id,
    label: line.label,
    note: line.counted ? line.status : `${line.status} · sudah lewat penjualan`,
    value: rupiah(line.amount),
    muted: !line.counted,
  }));

  const sales: LedgerRow[] = report.sales.map((line) => ({
    id: line.id,
    label: line.label,
    note: `${line.settled ? "lunas" : "belum bayar"}${line.method ? ` · ${line.method}` : ""}`,
    value: rupiah(line.amount),
  }));

  const cashTx: LedgerRow[] = report.cashTx.map((line) => ({
    id: line.id,
    label: line.label,
    note: line.direction === "pemasukan" ? "masuk" : "keluar",
    value: `${line.direction === "pemasukan" ? "+" : "-"} ${rupiah(line.amount)}`,
  }));

  async function handlePrint() {
    const printed = await printShiftReport(report);
    if (!printed) toast.error("Struk gagal dibuat. Cetak manual dari Laporan Shift.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 gap-1 border-b border-black/5 px-5 py-4 pr-14 dark:border-white/10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-50">Rekap kas</p>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-heading text-lg font-medium tracking-tight">{title}</DialogTitle>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                shiftOpen
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {shiftOpen ? "Masih terbuka" : "Sudah ditutup"}
            </span>
            {duration ? <span className="text-[11px] opacity-55">{duration}</span> : null}
          </div>
          <DialogDescription className="text-xs">
            {report.branchName} · {report.employeeName} · {shiftDateLabel(report.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-black/5 dark:lg:divide-white/10">
            {/* 1. Informasi shift */}
            <section className="min-w-0 lg:pr-5">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">
                Informasi shift
              </h3>
              <dl className="mt-2 space-y-1.5 text-xs">
                <InfoRow label="Cabang" value={report.branchName} />
                <InfoRow label="Kasir" value={report.employeeName} />
                <InfoRow label="Buka" value={shiftClock(report.openAt)} />
                <InfoRow label="Tutup" value={shiftOpen ? "—" : shiftClock(report.closingAt)} />
                {report.closedByName ? <InfoRow label="Ditutup oleh" value={report.closedByName} /> : null}
                <InfoRow label="Durasi" value={duration ?? "—"} />
                <InfoRow label="Saldo awal" value={rupiah(report.openingBalance)} numeric />
              </dl>

              {stats ? (
                <>
                  <h3 className="mt-5 text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">
                    Servis hari ini
                  </h3>
                  <dl className="mt-2 grid grid-cols-2 gap-1.5">
                    <Stat label="Masuk" value={stats.masuk} />
                    <Stat label="Selesai" value={stats.selesai} />
                    <Stat label="Diambil" value={stats.diambil} />
                    <Stat label="Batal" value={stats.batal} />
                  </dl>
                </>
              ) : null}

              {report.spareparts?.length ? (
                <>
                  <h3 className="mt-5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">
                    <PackageIcon className="size-3" />
                    Sparepart terpakai
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    {report.spareparts.map((part) => (
                      <li key={part.name} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate opacity-70">{part.name}</span>
                        <span className="shrink-0 tabular-nums">×{part.qty}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            {/* 2. Transaksi shift */}
            <section className="min-w-0 lg:px-5">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">
                Transaksi shift
              </h3>
              <div className="mt-2">
                <LedgerSection
                  icon={WrenchIcon}
                  title="Servis"
                  count={report.services.length}
                  total={rupiah(report.totals.services)}
                  rows={services}
                  empty="Belum ada servis pada shift ini."
                />
                <LedgerSection
                  icon={ShoppingCartIcon}
                  title="Penjualan"
                  count={report.sales.length}
                  total={rupiah(report.totals.sales)}
                  rows={sales}
                  empty="Belum ada penjualan pada shift ini."
                />
                <LedgerSection
                  icon={WalletIcon}
                  title="Kas manual"
                  count={report.cashTx.length}
                  total={`${report.totals.manualNet < 0 ? "-" : "+"} ${rupiah(Math.abs(report.totals.manualNet))}`}
                  rows={cashTx}
                  empty="Belum ada kas masuk/keluar manual."
                />
              </div>
            </section>

            {/* 3. Overview + aksi */}
            <section className="flex min-w-0 flex-col lg:pl-5">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">
                Overview
              </h3>
              <div className="mt-2 rounded-xl bg-brand/[0.08] px-3.5 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-60">
                  Harus ada di laci
                </p>
                <p className="mt-1.5 font-heading text-[1.75rem] leading-none tracking-[-0.02em] tabular-nums">
                  {rupiah(report.expectedCash)}
                </p>
              </div>

              <dl className="mt-3 space-y-1.5 text-xs">
                {shiftBreakdown(report).map((row) => (
                  <div key={row.key} className="flex items-baseline justify-between gap-2">
                    <span className="opacity-65">{row.label}</span>
                    <span className="tabular-nums">
                      {row.tone === "out" ? "- " : row.tone === "in" ? "+ " : ""}
                      {rupiah(row.amount)}
                    </span>
                  </div>
                ))}
              </dl>

              {!shiftOpen ? (
                <div className="mt-3 space-y-1.5 rounded-xl border border-black/5 px-3 py-2.5 text-xs dark:border-white/10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="opacity-65">Saldo akhir fisik</span>
                    <span className="font-medium tabular-nums">{rupiah(report.closingBalance ?? 0)}</span>
                  </div>
                  <VarianceRow variance={report.variance} reason={report.reason} />
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => void handlePrint()}>
                  <PrinterIcon className="size-4" /> Cetak
                </Button>
                {shiftOpen && onCloseShop ? (
                  <Button className="w-full" onClick={onCloseShop}>
                    Tutup Toko
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 opacity-60">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right", numeric && "font-medium tabular-nums")}>
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.05]">
      <dt className="text-[10px] leading-none opacity-55">{label}</dt>
      <dd className="mt-1 font-heading text-base leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function LedgerSection({
  icon: Icon,
  title,
  count,
  total,
  rows,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  total: string;
  rows: LedgerRow[];
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PREVIEW_ROWS);
  const hidden = rows.length - shown.length;

  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0 opacity-50" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{title}</span>
        <span className="shrink-0 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums opacity-70 dark:bg-white/[0.08]">
          {count}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums opacity-80">{total}</span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-1.5 px-0.5 text-[11px] italic opacity-40">{empty}</p>
      ) : (
        <ul className="mt-1.5">
          {shown.map((row, index) => (
            <li
              key={row.id}
              className={cn(
                "flex items-baseline justify-between gap-2 py-1.5 text-[11px]",
                index < shown.length - 1 && "border-b border-black/[0.04] dark:border-white/[0.06]",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{row.label}</span>
                {row.note ? <span className="block truncate text-[10px] opacity-50">{row.note}</span> : null}
              </span>
              <span className={cn("shrink-0 tabular-nums", row.muted && "opacity-50")}>{row.value}</span>
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              {/* Frontliner tidak punya akses ke /app/laporan/shift, jadi
                  baris sisanya dibuka di tempat, bukan lewat tautan. */}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex w-full items-center justify-between gap-2 py-1 text-[11px] opacity-55 transition-opacity hover:opacity-100"
              >
                <span>+{hidden} lainnya</span>
                <ChevronRightIcon className="size-3" />
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
