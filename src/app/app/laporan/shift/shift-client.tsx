"use client";

import { useCallback, useEffect, useState } from "react";
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
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { shiftLabel, type ShiftReport } from "@/lib/operational/laporan-shift";
import { getShiftPreview, getShiftReport, listShiftSessions, type CashSessionRow } from "@/app/app/actions/cash";
import { ShiftReportView } from "@/components/cash/shift-report";
import { ShiftExportBar } from "@/components/cash/shift-export-bar";
import { OpeningBalanceDialog } from "@/components/cash/opening-balance-dialog";
import { ClosingDialog } from "@/components/cash/closing-dialog";
import { AdjustmentDialog } from "@/components/cash/adjustment-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PlainTableRowsSkeleton } from "@/components/ui/skeleton-shapes";
import { PageHeader } from "@/components/layout/page-header";
import { ALL_BRANCH, useBranch } from "@/lib/branch-context";

function sessionDate(session: CashSessionRow): string {
  const opened = new Date(session.openAt);
  return Number.isNaN(opened.getTime()) ? "—" : kalenderWIB(opened);
}

function varianceTone(variance: number | null): string {
  if (variance === null) return "text-muted-foreground";
  if (variance === 0) return "text-emerald-600 dark:text-emerald-400";
  if (variance < 0) return "text-destructive";
  return "text-amber-600 dark:text-amber-400";
}

/** Kerangka isi laporan shift: header, saldo awal, 3 section, lalu total. */
function ShiftReportSkeleton() {
  return (
    <div aria-hidden className="space-y-4 text-sm">
      <div>
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-2 h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>

      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-3 w-40" />
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3">
              <Skeleton
                className="h-3"
                style={{ width: `${40 + ((section * 9 + row * 13) % 30)}%` }}
              />
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ))}

      <div className="space-y-1.5 border-t border-border/60 pt-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3">
            <Skeleton
              className="h-3"
              style={{ width: `${35 + ((row * 11) % 25)}%` }}
            />
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
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
  const { branch } = useBranch();
  const [sessions, setSessions] = useState<CashSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CashSessionRow | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // Kas adalah aksi per cabang. Saat scope "Semua cabang", server action tidak
  // punya `branchId`, jadi tombol dimatikan dan meminta pengguna memilih satu.
  const cashUnavailable = branch.id === ALL_BRANCH.id;
  const cashHint = cashUnavailable ? "Pilih cabang dulu" : undefined;
  const openSession = sessions.find((session) => session.closedAt === null) ?? null;

  const reload = useCallback(async () => {
    if (cashUnavailable) {
      setLoading(false);
      return;
    }
    const result = await listShiftSessions();
    if (result.ok) {
      setSessions(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [cashUnavailable]);

  const handleOpened = useCallback(() => {
    setOpeningOpen(false);
    void reload();
  }, [reload]);

  // Effect hanya melakukan fetch; state awal sudah `loading`, jadi tidak ada
  // setState sinkron di body. Refresh dipanggil dari event handler.
  useEffect(() => {
    let cancelled = false;
    listShiftSessions().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSessions(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
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
        actions={
          <div className="flex items-center gap-2">
            {openSession ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cashUnavailable}
                  title={cashHint}
                  onClick={() => setAdjustOpen(true)}
                >
                  Catat Kas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cashUnavailable}
                  title={cashHint}
                  onClick={() => setClosingOpen(true)}
                >
                  Tutup Shift
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={cashUnavailable || loading}
                title={cashHint}
                onClick={() => setOpeningOpen(true)}
              >
                Buka Shift
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {error && !cashUnavailable ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}

        {cashUnavailable ? (
          <p className="text-sm text-muted-foreground">
            Pilih cabang dulu untuk melihat laporan shift.
          </p>
        ) : sessions.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">Belum ada shift kas tercatat.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  <th className="px-3 py-2 font-normal">Tanggal / Shift</th>
                  <th className="px-3 py-2 font-normal">Cabang</th>
                  <th className="px-3 py-2 font-normal">Dibuka oleh</th>
                  <th className="px-3 py-2 text-right font-normal">Saldo awal</th>
                  <th className="px-3 py-2 text-right font-normal">Saldo akhir</th>
                  <th className="px-3 py-2 text-right font-normal">Selisih</th>
                  <th className="px-3 py-2 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <PlainTableRowsSkeleton
                    cells={["text", "text", "text", "money", "money", "money", "icon"]}
                    rows={5}
                    rowClassName="border-b border-border/60"
                    cellClassName="px-3 py-2"
                  />
                ) : (
                  sessions.map((session) => {
                  const closed = session.closedAt !== null;
                  return (
                    <tr key={session.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        <span className="block">{sessionDate(session)}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {shiftLabel(session, session.shiftNumber)}
                        </span>
                      </td>
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
                })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={Boolean(viewing)} onOpenChange={(next) => !next && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Laporan {viewing ? shiftLabel(viewing, viewing.shiftNumber) : ""}
            </DialogTitle>
            <DialogDescription>
              {viewing ? `${sessionDate(viewing)} · ` : ""}
              {viewing?.closedAt
                ? "Dibaca dari snapshot saat shift ditutup."
                : "Shift masih terbuka — angka dihitung live dan bisa berubah."}
            </DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <ShiftReportSkeleton />
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

      {openingOpen ? (
        <OpeningBalanceDialog
          dismissible
          onClose={() => setOpeningOpen(false)}
          onOpened={handleOpened}
        />
      ) : null}

      <ClosingDialog
        open={closingOpen}
        onOpenChange={setClosingOpen}
        session={openSession}
        onClosed={() => void reload()}
      />

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={() => void reload()}
      />
    </div>
  );
}
