"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyPlain } from "@/lib/format";
import type { ShiftReport } from "@/lib/operational/laporan-shift";
import { getShiftPreview, getShiftReport, listShiftSessions, type CashSessionRow } from "@/app/app/actions/cash";
import { ShiftReportView } from "@/components/cash/shift-report";
import { ShiftExportBar } from "@/components/cash/shift-export-bar";
import { PageHeader } from "@/components/layout/page-header";

function sessionDate(session: CashSessionRow): string {
  const opened = new Date(session.openAt);
  return Number.isNaN(opened.getTime()) ? "—" : opened.toISOString().slice(0, 10);
}

function varianceTone(variance: number | null): string {
  if (variance === null) return "text-muted-foreground";
  if (variance === 0) return "text-emerald-600 dark:text-emerald-400";
  if (variance < 0) return "text-destructive";
  return "text-amber-600 dark:text-amber-400";
}

/**
 * Laporan Shift.
 *
 * Hanya sesi yang sudah ditutup yang punya laporan final dan tombol unduh;
 * sesi terbuka hanya menampilkan preview live lewat `getShiftPreview()`.
 * Snapshot dibaca apa adanya — tidak dihitung ulang — supaya laporan yang
 * sudah diunduh tidak berubah karena ada koreksi di kemudian hari.
 */
export default function LaporanShiftClient() {
  const [sessions, setSessions] = useState<CashSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CashSessionRow | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Effect hanya melakukan fetch; state awal sudah `loading`, jadi tidak ada
  // setState sinkron di body. Refresh dipanggil dari event handler.
  useEffect(() => {
    let cancelled = false;
    listShiftSessions().then((result) => {
      if (cancelled) return;
      if (result.ok) setSessions(result.data);
      else setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openReport = async (session: CashSessionRow) => {
    setViewing(session);
    setViewLoading(true);
    setReport(null);
    const result = session.closedAt ? await getShiftReport(session.id) : await getShiftPreview(session.id);
    if (!result.ok) {
      toast.error(result.error);
      setViewLoading(false);
      return;
    }
    setReport(result.data);
    setViewLoading(false);
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Laporan Shift"
        titleClassName="font-heading text-2xl"
        description="Rekap kas per shift: layanan servis, penjualan, dan transaksi manual."
      />

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat daftar shift...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada shift kas tercatat.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  <th className="px-3 py-2 font-normal">Tanggal</th>
                  <th className="px-3 py-2 font-normal">Cabang</th>
                  <th className="px-3 py-2 font-normal">Frontliner</th>
                  <th className="px-3 py-2 text-right font-normal">Saldo awal</th>
                  <th className="px-3 py-2 text-right font-normal">Saldo akhir</th>
                  <th className="px-3 py-2 text-right font-normal">Selisih</th>
                  <th className="px-3 py-2 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const closed = session.closedAt !== null;
                  return (
                    <tr key={session.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{sessionDate(session)}</td>
                      <td className="px-3 py-2">{session.branchName}</td>
                      <td className="px-3 py-2">{session.employeeName}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {formatCurrencyPlain(session.openingBalance)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {session.closingBalance === null
                          ? "—"
                          : formatCurrencyPlain(session.closingBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-xs ${varianceTone(session.variance)}`}
                      >
                        {session.variance === null
                          ? "belum tutup"
                          : formatCurrencyPlain(session.variance)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="xs" variant="ghost" onClick={() => openReport(session)}>
                            Lihat
                          </Button>
                          {/* Download dan copy hanya untuk shift yang sudah
                              ditutup: shift terbuka belum punya laporan final
                              dan snapshot-nya masih kosong. */}
                          {closed ? (
                            <ShiftExportBar
                              size="sm"
                              load={async () => {
                                const result = await getShiftReport(session.id);
                                if (!result.ok) {
                                  toast.error(result.error);
                                  return null;
                                }
                                return result.data;
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={Boolean(viewing)} onOpenChange={(next) => !next && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Laporan Shift {viewing ? sessionDate(viewing) : ""}
            </DialogTitle>
            <DialogDescription>
              {viewing?.closedAt
                ? "Dibaca dari snapshot saat shift ditutup."
                : "Shift masih terbuka — angka dihitung live dan bisa berubah."}
            </DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat laporan...</p>
          ) : report ? (
            <>
              <ShiftReportView report={report} showClosing={viewing?.closedAt !== null} />
              {viewing?.closedAt ? <ShiftExportBar report={report} /> : null}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Laporan tidak tersedia.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
