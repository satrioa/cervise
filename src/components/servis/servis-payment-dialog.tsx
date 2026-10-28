"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyPlain } from "@/lib/format";
import { ServisPaymentPanel } from "./servis-payment-panel";
import { getPembayaranHistory, getServisDetail, type ServisDetail } from "@/app/app/servis/actions";
import { getServisSpareparts, type ServisSparepartRow } from "@/app/app/servis/sparepart-actions";

type Props = {
  servisId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
};

type DialogData = {
  detail: ServisDetail | null;
  spareparts: ServisSparepartRow[];
  estimasi: number | null;
  totalPaid: number;
};

/** Ringkasan servis di kolom kiri dialog bayar. */
function RincianServis({ data }: { data: DialogData }) {
  const d = data.detail;
  const device = d ? `${(d as any).merk ?? ""} ${(d as any).tipe ?? ""}`.trim() || d.device : "—";
  const kerusakan: string[] = Array.isArray((d as any)?.kerusakan) ? (d as any).kerusakan : [];
  const customer = (d as any)?.cervise_customers;
  const active = data.spareparts.filter((sp) => !sp.is_returned);
  const sparepartTotal = active.reduce((sum, sp) => sum + Number(sp.line_total ?? 0), 0);

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <h3 className="font-semibold text-sm">Rincian Servis</h3>
      <div className="space-y-0.5">
        <div className="font-medium leading-tight">{device}</div>
        <div className="font-mono text-xs text-muted-foreground">{d?.service_number ?? d?.id ?? "—"}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {d?.status ? <Badge variant="outline">{d.status}</Badge> : null}
        {customer?.name ? <Badge variant="secondary">{customer.name}</Badge> : null}
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Kerusakan</div>
        {kerusakan.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {kerusakan.map((k) => <Badge key={k} variant="secondary" className="rounded-full">{k}</Badge>)}
          </div>
        ) : (
          <p className="text-sm">{d?.complaint || "—"}</p>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Sparepart dipakai</div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada sparepart</p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-background">
            <div className="divide-y">
              {active.map((sp) => (
                <div key={sp.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                  <span className="truncate">{sp.name}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{sp.qty} × {formatCurrencyPlain(Number(sp.unit_price ?? 0))}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs font-medium">
              <span>Total sparepart</span>
              <span className="font-mono">{formatCurrencyPlain(sparepartTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dialog bayar servis dari luar halaman detail.
 *
 * Halaman detail sudah punya detail + riwayat, jadi panelnya bisa langsung
 * diisi. Dari daftar servis (context menu) datanya belum ada, jadi dialog ini
 * ambil sendiri: patokan tagihan (`price_estimasi`), total yang sudah dibayar
 * dari ledger kas, dan sparepart untuk kolom "Rincian Servis".
 */
export function ServisPaymentDialog({ servisId, open, onOpenChange, onPaid }: Props) {
  // Data ditandai dengan key servisnya, jadi pindah servis tidak menyisakan
  // angka servis sebelumnya tanpa perlu reset state di dalam effect.
  const [data, setData] = useState<(DialogData & { key: string }) | null>(null);

  useEffect(() => {
    if (!open || !servisId) return;
    let cancelled = false;
    Promise.all([getServisDetail(servisId), getPembayaranHistory(servisId), getServisSpareparts(servisId)])
      .then(([detail, history, spareparts]) => {
        if (cancelled) return;
        setData({
          key: servisId,
          detail,
          spareparts,
          estimasi: (detail as { price_estimasi?: number | null })?.price_estimasi ?? null,
          totalPaid: (history as { amount?: number }[]).reduce((a, b) => a + Number(b.amount ?? 0), 0),
        });
      })
      .catch(() => {
        if (!cancelled) setData({ key: servisId, detail: null, spareparts: [], estimasi: null, totalPaid: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [open, servisId]);

  const ready = data?.key === servisId;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[96vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-6 shadow-2xl overflow-hidden">
          <DialogPrimitive.Title className="shrink-0 font-semibold">Bayar Servis</DialogPrimitive.Title>
          <div className="mt-4 min-h-0 overflow-y-auto">
            {!ready ? (
              <Skeleton className="h-40 w-full" />
            ) : servisId ? (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <RincianServis data={data} />
                <ServisPaymentPanel
                  servisId={servisId}
                  estimasi={data.estimasi}
                  totalPaid={data.totalPaid}
                  onSuccess={() => {
                    onPaid?.();
                    onOpenChange(false);
                  }}
                  onClose={() => onOpenChange(false)}
                />
              </div>
            ) : null}
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
