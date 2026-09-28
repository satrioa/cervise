"use client";

import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import { cn } from "@/lib/utils";

/**
 * Tampilan Laporan Shift. Dipakai di tiga tempat: dialog Tutup Toko (tahap
 * preview), halaman `/app/laporan/shift` (Lihat), dan printer PDF.
 *
 * Sengaja tanpa interaksi: komponen yang sama harus menghasilkan output yang
 * sama di layar maupun di kertas, jadi format teks dan format PDF memakai
 * angka dari `ShiftReport` yang sama.
 */
export function ShiftReportView({
  report,
  showClosing = false,
  className,
}: {
  report: ShiftReport;
  /** false saat preview — saldo akhir belum diinput. */
  showClosing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 text-sm", className)}>
      <header>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
          Laporan Shift
        </div>
        <div className="mt-1 font-heading text-lg">{report.branchName}</div>
        <div className="text-xs text-muted-foreground">
          {report.employeeName} · {report.date}
        </div>
      </header>

      <Block title={`Saldo awal — ${rupiah(report.openingBalance)}`} />

      <Section title={`Layanan servis (${report.services.length})`} empty="Tidak ada servis pada shift ini.">
        {report.services.map((line) => (
          <Row
            key={line.id}
            label={line.label}
            note={line.counted ? line.status : `${line.status} · sudah lewat penjualan`}
            value={rupiah(line.amount)}
            muted={!line.counted}
          />
        ))}
      </Section>

      <Section title={`Penjualan (${report.sales.length})`} empty="Tidak ada penjualan pada shift ini.">
        {report.sales.map((line) => (
          <Row
            key={line.id}
            label={line.label}
            note={`${line.settled ? "lunas" : "belum bayar"}${line.method ? ` · ${line.method}` : ""}`}
            value={rupiah(line.amount)}
          />
        ))}
      </Section>

      <Section
        title={`Transaksi kas manual (${report.cashTx.length})`}
        empty="Tidak ada pemasukan atau pengeluaran manual."
      >
        {report.cashTx.map((line) => (
          <Row
            key={line.id}
            label={line.label}
            note={line.direction === "pemasukan" ? "masuk" : "keluar"}
            value={`${line.direction === "pemasukan" ? "+" : "-"} ${rupiah(line.amount)}`}
          />
        ))}
      </Section>

      <div className="space-y-1 border-t border-border/60 pt-3">
        <Row label="Omzet servis" value={rupiah(report.totals.services)} />
        <Row label="Omzet penjualan" value={rupiah(report.totals.sales)} />
        <Row
          label="Transaksi manual"
          value={`${report.totals.manualNet < 0 ? "-" : "+"} ${rupiah(Math.abs(report.totals.manualNet))}`}
        />
        <div className="flex items-baseline justify-between border-t border-border/60 pt-2 font-medium">
          <span>Harus ada di laci</span>
          <span className="font-mono">{rupiah(report.totals.expected)}</span>
        </div>
      </div>

      {showClosing && report.closingBalance !== null ? (
        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Row label="Saldo akhir fisik" value={rupiah(report.closingBalance)} />
          <VarianceRow variance={report.variance} reason={report.reason} />
        </div>
      ) : null}
    </div>
  );
}

export function VarianceRow({
  variance,
  reason,
}: {
  variance: number | null;
  reason: string | null;
}) {
  if (variance === null) {
    return (
      <div className="flex items-baseline justify-between text-muted-foreground">
        <span>Saldo akhir belum dicatat</span>
      </div>
    );
  }

  if (variance === 0) {
    return (
      <div className="flex items-baseline justify-between text-emerald-600 dark:text-emerald-400">
        <span>Saldo sesuai</span>
        <span className="font-mono">Rp 0</span>
      </div>
    );
  }

  const kurang = variance < 0;
  return (
    <div
      className={cn(
        "flex items-baseline justify-between",
        kurang ? "text-destructive" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <span>{kurang ? "Kurang" : "Lebih"}</span>
      <span className="font-mono">{rupiah(Math.abs(variance))}</span>
      {reason ? <span className="w-full text-xs opacity-80">{reason}</span> : null}
    </div>
  );
}

function Block({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 font-medium">
      {title}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
        {title}
      </div>
      <div className="mt-1.5 space-y-1">
        {hasItems ? (
          children
        ) : (
          <p className="text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  note,
  value,
  muted = false,
}: {
  label: string;
  note?: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", muted && "opacity-60")}>
      <div className="min-w-0">
        <div className="truncate">{label}</div>
        {note ? <div className="truncate text-xs text-muted-foreground">{note}</div> : null}
      </div>
      <span className="shrink-0 font-mono text-xs">{value}</span>
    </div>
  );
}
